import { useState } from 'react';
import { apiRequest } from '../services/api';

export default function AuthPanel({ notify }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault();
    setError('');
    try {
      const result = await apiRequest(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      localStorage.setItem('injurysenseUser', JSON.stringify({ ...result.user, token: result.token }));
      notify(`${mode === 'login' ? 'Signed in' : 'Account created'} successfully`);
      window.location.reload();
    } catch (requestError) { setError(requestError.message); }
  };
  return <section className="page"><div className="section-intro"><span className="tag">ACCOUNT SECURITY</span><h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2><p>Sign in to save sessions and view only your own reports.</p></div><div className="two-col"><form className="card" onSubmit={submit}>{mode === 'register' && <label>Name<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>}<label>Email<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label><label>Password<input required minLength="6" type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>{error && <div className="error-box">{error}</div>}<button className="primary" type="submit">{mode === 'login' ? 'Sign in' : 'Register'}</button></form><div className="card"><h3>Private session history</h3><p className="muted">Your JWT is kept in browser storage and sent only to the InjurySense API. Passwords are hashed server-side and never returned.</p><button className="ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Need an account?' : 'Already registered?'}</button></div></div></section>;
}
