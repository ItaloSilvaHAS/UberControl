(() => {
  const accessScreen = document.getElementById("accessScreen");
  const dashboardApp = document.getElementById("dashboardApp");
  const authPanel = document.getElementById("authPanel");
  const recoveryPanel = document.getElementById("recoveryPanel");
  const subscriptionPanel = document.getElementById("subscriptionPanel");
  const authForm = document.getElementById("authForm");
  const newPasswordForm = document.getElementById("newPasswordForm");
  const authMessage = document.getElementById("authMessage");
  const recoveryMessage = document.getElementById("recoveryMessage");
  const subscriptionMessage = document.getElementById("subscriptionMessage");
  const authSubmit = document.getElementById("authSubmit");
  const authTitle = document.getElementById("authTitle");
  const authDescription = document.getElementById("authDescription");
  const checkoutButton = document.getElementById("checkoutButton");
  const verifyAccessButton = document.getElementById("verifyAccessButton");
  const accountEmail = document.getElementById("accountEmail");
  const manageSubscriptionButton = document.getElementById("btnManageSubscription");
  const signOutButtons = [
    document.getElementById("btnSignOut"),
    document.getElementById("signOutButton"),
  ].filter(Boolean);
  let authClient;
  let authMode = "login";
  let currentUserId = null;
  let openingDashboard = false;
  let ignoreNextSignOutEvent = false;

  function setMessage(element, message = "", kind = "") {
    if (!element) return;
    element.textContent = message;
    element.dataset.kind = kind;
    element.classList.toggle("visible", Boolean(message));
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    if (label) button.dataset.originalLabel ||= button.innerHTML;
    button.innerHTML = busy ? label : button.dataset.originalLabel || label;
  }

  function friendlyAuthError(error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("invalid login") || message.includes("invalid credentials")) {
      return "E-mail ou senha incorretos.";
    }
    if (message.includes("already registered") || message.includes("already been registered")) {
      return "Este e-mail já tem uma conta. Entre ou recupere sua senha.";
    }
    if (message.includes("password") && message.includes("weak")) {
      return "Escolha uma senha mais forte, com pelo menos 8 caracteres.";
    }
    if (message.includes("rate limit")) {
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    }
    return "Não foi possível concluir. Confira os dados e tente novamente.";
  }

  function showAuth(message = "", kind = "") {
    accessScreen.hidden = false;
    dashboardApp.classList.add("hidden");
    authPanel.classList.remove("hidden");
    recoveryPanel.classList.add("hidden");
    subscriptionPanel.classList.add("hidden");
    setMessage(authMessage, message, kind);
    setMessage(subscriptionMessage);
    setMessage(recoveryMessage);
    accountEmail.textContent = "";
    manageSubscriptionButton.classList.add("hidden");
  }

  function showPaywall(user, message = "", kind = "") {
    accessScreen.hidden = false;
    dashboardApp.classList.add("hidden");
    authPanel.classList.add("hidden");
    recoveryPanel.classList.add("hidden");
    subscriptionPanel.classList.remove("hidden");
    accountEmail.textContent = user?.email || "";
    setMessage(subscriptionMessage, message, kind);
  }

  async function apiRequest(url, options = {}) {
    const { data: { session } } = await authClient.auth.getSession();
    if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || "Não foi possível concluir a solicitação.");
      error.status = response.status;
      throw error;
    }
    return result;
  }

  async function showDashboard(user) {
    if (openingDashboard || user.id === currentUserId && !dashboardApp.classList.contains("hidden")) return;
    openingDashboard = true;
    setMessage(subscriptionMessage, "Carregando seus dados…", "info");
    try {
      const [transactionData, settings] = await Promise.all([
        apiRequest("/api/transactions"),
        apiRequest("/api/settings"),
      ]);
      if (typeof window.initUberControl !== "function") {
        throw new Error("O painel ainda não terminou de carregar. Atualize a página.");
      }
      currentUserId = user.id;
      accountEmail.textContent = user.email || "";
      accessScreen.hidden = true;
      dashboardApp.classList.remove("hidden");
      window.initUberControl({
        transactions: transactionData.transactions,
        dailyGoal: settings.dailyGoal,
      });
      const billing = await apiRequest("/api/billing/status");
      manageSubscriptionButton.classList.toggle("hidden", !billing.manageUrl);
    } catch (error) {
      currentUserId = null;
      showPaywall(user, error.status === 402
        ? "A assinatura ainda não está ativa. Após o pagamento, toque em verificar acesso."
        : error.message || "Não foi possível carregar seus dados.", "error");
    } finally {
      openingDashboard = false;
    }
  }

  async function handleSession(session) {
    if (!session?.user) {
      currentUserId = null;
      showAuth();
      return;
    }
    if (session.user.id === currentUserId && !dashboardApp.classList.contains("hidden")) return;
    showPaywall(session.user, "Verificando sua assinatura…", "info");
    try {
      const billing = await apiRequest("/api/billing/status");
      if (billing.active) {
        await showDashboard(session.user);
      } else {
        showPaywall(session.user);
      }
    } catch (error) {
      if (error.status === 401) {
        await authClient.auth.signOut();
        showAuth("Sua sessão expirou. Entre novamente.", "error");
        return;
      }
      showPaywall(session.user, error.message || "Não foi possível confirmar sua assinatura. Tente novamente.", "error");
    }
  }

  function setAuthMode(mode, clearMessage = true) {
    authMode = mode;
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.authMode === mode);
      button.setAttribute("aria-selected", String(button.dataset.authMode === mode));
    });
    authTitle.textContent = mode === "signup" ? "Comece por aqui" : "Bem-vindo de volta";
    authDescription.textContent = mode === "signup"
      ? "Crie sua conta gratuita para continuar."
      : "Entre para acompanhar sua operação.";
    authSubmit.innerHTML = mode === "signup"
      ? 'Criar conta <span aria-hidden="true">→</span>'
      : 'Entrar na conta <span aria-hidden="true">→</span>';
    document.getElementById("authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
    if (clearMessage) setMessage(authMessage);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!authClient) return;
    const form = new FormData(authForm);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    setBusy(authSubmit, true, authMode === "signup" ? "Criando conta…" : "Entrando…");
    setMessage(authMessage);
    try {
      if (authMode === "signup") {
        const { data, error } = await authClient.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          await handleSession(data.session);
        } else {
          setMessage(authMessage, "Enviamos um link para confirmar seu e-mail. Confirme-o antes de entrar.", "success");
        }
      } else {
        const { data, error } = await authClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await handleSession(data.session);
      }
    } catch (error) {
      setMessage(authMessage, friendlyAuthError(error), "error");
    } finally {
      setBusy(authSubmit, false);
      setAuthMode(authMode, false);
    }
  }

  async function startCheckout() {
    if (!authClient || !checkoutButton) return;
    const checkoutWindow = window.open("about:blank", "_blank", "noopener,noreferrer");
    setBusy(checkoutButton, true, "Preparando checkout…");
    setMessage(subscriptionMessage);
    try {
      const result = await apiRequest("/api/billing/checkout", { method: "POST", body: {} });
      if (result.active) {
        if (checkoutWindow) checkoutWindow.close();
        const { data: { session } } = await authClient.auth.getSession();
        if (session) await handleSession(session);
        return;
      }
      if (!checkoutWindow) {
        throw new Error("O navegador bloqueou a nova aba. Permita pop-ups e tente novamente.");
      }
      checkoutWindow.location.replace(result.purchaseUrl);
      setMessage(subscriptionMessage, "O checkout seguro foi aberto em outra aba. Volte aqui após pagar e verifique o acesso.", "success");
    } catch (error) {
      if (checkoutWindow) checkoutWindow.close();
      setMessage(subscriptionMessage, error.message || "Não foi possível iniciar o checkout. Tente novamente.", "error");
    } finally {
      setBusy(checkoutButton, false);
    }
  }

  async function verifyAccess() {
    const { data: { session } } = await authClient.auth.getSession();
    if (!session) return showAuth("Entre novamente para verificar o acesso.", "error");
    setBusy(verifyAccessButton, true, "Verificando…");
    try {
      const billing = await apiRequest("/api/billing/status");
      if (billing.active) {
        await showDashboard(session.user);
      } else {
        showPaywall(session.user, "Ainda não encontramos uma assinatura ativa. Se acabou de pagar, aguarde alguns segundos e tente de novo.", "info");
      }
    } catch (error) {
      showPaywall(session.user, error.message || "Não foi possível verificar agora.", "error");
    } finally {
      setBusy(verifyAccessButton, false);
    }
  }

  async function resetPassword() {
    if (!authClient) return;
    const email = document.getElementById("authEmail").value.trim().toLowerCase();
    if (!email) {
      setMessage(authMessage, "Informe seu e-mail para receber o link de recuperação.", "info");
      document.getElementById("authEmail").focus();
      return;
    }
    try {
      const { error } = await authClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setMessage(authMessage, "Se houver uma conta para esse e-mail, você receberá um link de recuperação.", "success");
    } catch {
      setMessage(authMessage, "Não foi possível enviar o link. Confira o e-mail e tente novamente.", "error");
    }
  }

  function showRecovery() {
    accessScreen.hidden = false;
    dashboardApp.classList.add("hidden");
    authPanel.classList.add("hidden");
    subscriptionPanel.classList.add("hidden");
    recoveryPanel.classList.remove("hidden");
    setMessage(recoveryMessage);
  }

  async function saveNewPassword(event) {
    event.preventDefault();
    const button = document.getElementById("saveNewPasswordButton");
    const password = document.getElementById("newPassword").value;
    if (password.length < 8) {
      setMessage(recoveryMessage, "A senha deve ter pelo menos 8 caracteres.", "error");
      return;
    }
    setBusy(button, true, "Salvando…");
    try {
      const { error } = await authClient.auth.updateUser({ password });
      if (error) throw error;
      ignoreNextSignOutEvent = true;
      await authClient.auth.signOut();
      showAuth("Senha atualizada. Entre com a nova senha.", "success");
    } catch {
      setMessage(recoveryMessage, "Não foi possível atualizar a senha. Abra novamente o link e tente de novo.", "error");
    } finally {
      setBusy(button, false);
    }
  }

  async function signOut() {
    if (!authClient) return;
    await authClient.auth.signOut();
    window.location.reload();
  }

  async function manageSubscription() {
    try {
      const billing = await apiRequest("/api/billing/status");
      if (!billing.manageUrl) {
        setMessage(subscriptionMessage, "Não encontramos o link de gerenciamento. Atualize o acesso e tente novamente.", "error");
        return;
      }
      window.open(billing.manageUrl, "_blank", "noopener,noreferrer");
    } catch {
      setMessage(subscriptionMessage, "Não foi possível abrir o gerenciamento da assinatura.", "error");
    }
  }

  async function boot() {
    try {
      const response = await fetch("/api/config", { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar a configuração do aplicativo.");
      const config = await response.json();
      if (!config.supabaseReady || !window.supabase?.createClient) {
        document.querySelectorAll("#authForm input, #authSubmit, #resetPasswordButton").forEach((control) => {
          control.disabled = true;
        });
        setMessage(authMessage, "Conclua a configuração segura do Supabase no ambiente para ativar as contas.", "error");
        return;
      }

      authClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      window.ubercontrolAPI = apiRequest;
      document.querySelectorAll("[data-auth-mode]").forEach((button) => {
        button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
      });
      authForm.addEventListener("submit", handleAuthSubmit);
      newPasswordForm.addEventListener("submit", saveNewPassword);
      document.getElementById("resetPasswordButton").addEventListener("click", resetPassword);
      checkoutButton.addEventListener("click", startCheckout);
      verifyAccessButton.addEventListener("click", verifyAccess);
      signOutButtons.forEach((button) => button.addEventListener("click", signOut));
      manageSubscriptionButton.addEventListener("click", manageSubscription);

      authClient.auth.onAuthStateChange((_event, session) => {
        window.setTimeout(() => {
          if (_event === "PASSWORD_RECOVERY") {
            showRecovery();
            return;
          }
          if (_event === "SIGNED_OUT" && ignoreNextSignOutEvent) {
            ignoreNextSignOutEvent = false;
            return;
          }
          void handleSession(session);
        }, 0);
      });
      const { data: { session }, error } = await authClient.auth.getSession();
      if (error) throw error;
      await handleSession(session);
    } catch {
      setMessage(authMessage, "O serviço está temporariamente indisponível. Atualize a página em instantes.", "error");
    }
  }

  void boot();
})();
