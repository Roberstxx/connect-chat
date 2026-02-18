import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { MessageCircle } from 'lucide-react';
import { registerWithWs, AuthWsError } from '@/services/auth';

export default function Register() {
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { login } = useApp();
  const navigate = useNavigate();

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((p) => ({ ...p, [key]: '', form: '' }));
  };

  const mapRegisterError = (message: string) => {
    const normalized = message.toLowerCase();
    if (normalized.includes('usuario ya existe')) return { username: 'Ese usuario ya existe.' };
    if (normalized.includes('correo ya está registrado')) return { email: 'Ese correo ya está registrado.' };
    if (normalized.includes('correo no es válido')) return { email: 'Correo electrónico inválido.' };
    if (normalized.includes('correo es obligatorio')) return { email: 'El correo es obligatorio.' };
    if (normalized.includes('nombre para mostrar es obligatorio')) return { name: 'El nombre es obligatorio.' };
    if (normalized.includes('usuario es obligatorio')) return { username: 'El usuario es obligatorio.' };
    if (normalized.includes('usuario debe tener entre')) return { username: message };
    if (normalized.includes('usuario solo puede contener')) return { username: message };
    if (normalized.includes('contraseña debe tener al menos')) return { password: message };
    return { form: message || 'No se pudo crear la cuenta.' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'El nombre es requerido';
    if (!form.username.trim()) errs.username = 'El usuario es requerido';
    if (!form.email.trim()) errs.email = 'El email es requerido';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Ingresa un email válido';
    if (form.password.length < 6) errs.password = 'Mínimo 6 caracteres';
    if (form.password !== form.confirm) errs.confirm = 'Las contraseñas no coinciden';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    try {
      setSubmitting(true);
      setErrors({});
      const { user } = await registerWithWs(form.username, form.name, form.email, form.password);
      await login(user);
      navigate('/app');
    } catch (err) {
      if (err instanceof AuthWsError) {
        setErrors((prev) => ({ ...prev, ...mapRegisterError(err.message) }));
      } else {
        setErrors((prev) => ({ ...prev, form: 'No se pudo crear la cuenta en el backend.' }));
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
          <h2 className="text-xl font-semibold text-foreground mb-6">Crear cuenta</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field id="name" label="Nombre" value={form.name} onChange={set('name')} error={errors.name} />
            <Field id="username" label="Usuario" value={form.username} onChange={set('username')} error={errors.username} />
            <Field id="email" label="Email" value={form.email} onChange={set('email')} error={errors.email} type="email" />
            <Field id="password" label="Contraseña" value={form.password} onChange={set('password')} error={errors.password} type="password" />
            <Field id="confirm" label="Confirmar contraseña" value={form.confirm} onChange={set('confirm')} error={errors.confirm} type="password" />
            {errors.form && <p className="text-destructive text-sm">{errors.form}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {submitting ? 'Creando...' : 'Crear cuenta'}
            </button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-muted-foreground mb-1.5">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
      />
      {error && <p className="text-destructive text-sm mt-1">{error}</p>}
    </div>
  );
}
