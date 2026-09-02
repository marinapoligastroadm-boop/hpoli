import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type AuthMode = "login" | "signup" | "forgot" | "recovery";

type AuthViewProps = {
  recoveryMode?: boolean;
  onRecoveryComplete?: () => void;
};

const friendlyError = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  if (normalized.includes("user already registered")) {
    return "Este e-mail já está cadastrado. Tente entrar ou redefinir a senha.";
  }
  if (normalized.includes("password should be")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  return message;
};

export function AuthView({
  recoveryMode = false,
  onRecoveryComplete,
}: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>(
    recoveryMode ? "recovery" : "login",
  );
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if ((mode === "signup" || mode === "recovery") && password.length < 6) {
      setMessage({
        type: "error",
        text: "A senha precisa ter pelo menos 6 caracteres.",
      });
      return;
    }

    if (mode === "recovery" && password !== confirmPassword) {
      setMessage({ type: "error", text: "As senhas não coincidem." });
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage({
            type: "success",
            text: "Cadastro realizado. Abra o e-mail de confirmação para liberar o acesso.",
          });
        }
        return;
      }

      if (mode === "forgot") {
        const redirectTo = `${window.location.origin}/?recovery=1`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        if (error) throw error;
        setMessage({
          type: "success",
          text: "Enviamos o link para redefinir sua senha. Verifique também a caixa de spam.",
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      window.history.replaceState({}, "", "/");
      setMessage({ type: "success", text: "Senha atualizada com sucesso." });
      onRecoveryComplete?.();
    } catch (error) {
      setMessage({
        type: "error",
        text: friendlyError(
          error instanceof Error ? error.message : "Não foi possível concluir.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const title = {
    login: "Acesse sua conta",
    signup: "Primeiro acesso",
    forgot: "Recuperar senha",
    recovery: "Crie uma nova senha",
  }[mode];

  const description = {
    login: "Entre para acompanhar e atualizar o faturamento.",
    signup: "Cadastre seus dados para solicitar o primeiro acesso.",
    forgot: "Informe seu e-mail para receber o link de recuperação.",
    recovery: "Digite e confirme sua nova senha de acesso.",
  }[mode];

  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label="HPOLI Centro Médico">
        <div className="auth-brand-content">
          <div className="brand-lockup brand-lockup-light">
            <span className="brand-symbol" aria-hidden="true">
              H
            </span>
            <span>
              <strong>HPOLI</strong>
              <small>Centro Médico</small>
            </span>
          </div>
          <div className="auth-statement">
            <span className="eyebrow">Gestão financeira</span>
            <h1>Faturamento claro, organizado e seguro.</h1>
            <p>
              Controle as unidades HPOLI, DIA e HOL em um único ambiente.
            </p>
          </div>
          <div className="auth-unit-list" aria-label="Unidades disponíveis">
            <span>HPOLI</span>
            <span>DIA</span>
            <span>HOL</span>
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          {mode !== "login" && mode !== "recovery" ? (
            <button
              className="back-button"
              type="button"
              onClick={() => changeMode("login")}
            >
              <ArrowLeft size={18} /> Voltar para o acesso
            </button>
          ) : null}

          <div className="auth-heading">
            <div className="auth-icon" aria-hidden="true">
              {mode === "forgot" || mode === "recovery" ? (
                <KeyRound size={24} />
              ) : (
                <LockKeyhole size={24} />
              )}
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "signup" ? (
              <label className="field">
                <span>Nome completo</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Seu nome"
                  required
                />
              </label>
            ) : null}

            {mode !== "recovery" ? (
              <label className="field">
                <span>E-mail</span>
                <span className="input-with-icon">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seuemail@exemplo.com"
                    required
                  />
                </span>
              </label>
            ) : null}

            {mode !== "forgot" ? (
              <label className="field">
                <span>{mode === "recovery" ? "Nova senha" : "Senha"}</span>
                <span className="input-with-icon">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    minLength={6}
                    required
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
            ) : null}

            {mode === "recovery" ? (
              <label className="field">
                <span>Confirmar nova senha</span>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a nova senha"
                  minLength={6}
                  required
                />
              </label>
            ) : null}

            {mode === "login" ? (
              <button
                className="forgot-link"
                type="button"
                onClick={() => changeMode("forgot")}
              >
                Esqueci minha senha
              </button>
            ) : null}

            {message ? (
              <div className={`form-message ${message.type}`} role="status">
                {message.text}
              </div>
            ) : null}

            <button className="primary-button auth-submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : null}
              {
                {
                  login: "Entrar",
                  signup: "Cadastrar",
                  forgot: "Enviar link de recuperação",
                  recovery: "Salvar nova senha",
                }[mode]
              }
            </button>
          </form>

          {mode === "login" ? (
            <div className="auth-footer">
              <span>Ainda não tem acesso?</span>
              <button type="button" onClick={() => changeMode("signup")}>
                Fazer primeiro acesso
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
