import React, { useState, useEffect } from 'react';
import { App } from './App.jsx';
import { SignIn } from './Identity.jsx';
import { api } from './api.js';
import { ErrorBox } from './components.jsx';
export function SessionShell() {
  const [state, setState] = useState({
      status: 'loading',
      mode: null,
      boot: null
    }),
    [error, setError] = useState('');
  async function load() {
    setError('');
    try {
      const s = await api('/auth/status');
      if (s.mode === 'sample') await api('/local-session', {});
      if (s.mode === 'setup') {
        setState({
          status: 'login',
          mode: 'setup'
        });
        return;
      }
      try {
        const b = await api('/bootstrap');
        setState({
          status: 'ready',
          mode: s.mode,
          boot: b
        });
      } catch (e) {
        if (e.status === 401) setState({
          status: 'login',
          mode: s.mode
        });else throw e;
      }
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    const expired = () => {
      setState(s => s.mode === 'local' ? {
        status: 'login',
        mode: 'local'
      } : s);
    };
    window.addEventListener('builder-session-expired', expired);
    return () => window.removeEventListener('builder-session-expired', expired);
  }, []);
  async function signOut(options = {}) {
    try {
      if (!options.sessionEnded) await api('/logout', {});
    } catch (e) {
      if (e.status !== 401) {
        setError(e.message);
        return;
      }
    }
    setState({
      status: 'login',
      mode: state.mode === 'sample' ? 'sample' : 'local'
    });
  }
  if (state.status === 'ready') return <App initialBoot={state.boot} onSignOut={signOut} onSetup={() => setState({
    status: 'login',
    mode: 'setup',
    returnToSample: true
  })} />;
  if (state.status === 'login' && state.mode === 'sample') return <div className="identity-page"><main className="identity-card"><h1>Example session ended.</h1><p>The example workspace uses a synthetic identity. Set up individual sign-in to secure this database.</p><button className="primary" onClick={() => setState({
        status: 'login',
        mode: 'setup',
        returnToSample: true
      })}>Set up local sign-in</button><button className="secondary" onClick={load}>Return to example workspace</button></main></div>;
  if (state.status === 'login') return <SignIn key={state.mode} mode={state.mode} onReady={() => {
    location.hash = 'section=Home';
    return load();
  }} onBack={state.returnToSample || state.mode === 'sample' ? load : undefined} />;
  return <div className="identity-page"><main className="identity-card"><h1>Builder ERP</h1><ErrorBox message={error} retry={load} />{!error && <p>Opening your workspace…</p>}</main></div>;
}
