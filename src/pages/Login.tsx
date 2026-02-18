import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { MessageCircle } from 'lucide-react';
import { loginWithWs, AuthWsError } from '@/services/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const { login } = useApp();
  const navigate = useNavigate();

  const mapLoginError = (message: string) => {
    const normalized = message.toLowerCase();
    if (normalized.includes('usuario o contraseña incorrectos')) {
      return { password: 'Usuario o contraseña incorrectos.' };
    }
    if (normalized.includes('contraseña es obligatoria')) {
      return { password: 'La contraseña es obligatoria.' };
    }
    if (normalized.includes('usuario o correo es obligatorio')) {
      return { email: 'Debes ingresar usuario o correo.' };
    }
    return { form: message || 'No se pudo iniciar sesión. Intenta nuevamente.' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = 'El email o usuario es requerido';
    if (!password.trim()) errs.password = 'La contraseña es requerida';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    try {
      setSubmitting(true);
      setErrors({});
      const { user } = await loginWithWs(email, password);
      await login(user);
      navigate('/app');
    } catch (err) {
      if (err instanceof AuthWsError) {
        setErrors(mapLoginError(err.message));
      } else {
        setErrors({ form: 'No se pudo iniciar sesión con el backend WebSocket.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Chat Local</h1>
        </div>

        <div className="bg-card rounded-2xl p-8 border border-border shadow-lg">
          <h2 className="text-xl font-semibold text-foreground mb-6">Iniciar sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1.5">
                Email o usuario
              </label>
              <input
                id="email"
                type="text"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined, form: undefined })); }}
                className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                placeholder="tu@email.com"
                aria-label="Email o usuario"
              />
              {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined, form: undefined })); }}
                className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                placeholder="••••••••"
                aria-label="Contraseña"
              />
              {errors.password && <p className="text-destructive text-sm mt-1">{errors.password}</p>}
            </div>
            {errors.form && <p className="text-destructive text-sm">{errors.form}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              aria-label="Iniciar sesión"
            >
              {submitting ? 'Conectando...' : 'Iniciar sesión'}
            </button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Crear cuenta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
