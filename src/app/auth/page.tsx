'use client';

import { useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push('/brain2');
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        // Also create the profile for the user
        if (data.user) {
           await supabase.from('profiles').insert({
             id: data.user.id,
             email: data.user.email,
             role: 'doctor' // default for testing
           });
        }
        router.push('/brain2');
      }
    }
  };

  return (
    <div style={{ padding: '50px', maxWidth: '400px', margin: '0 auto', color: 'white' }}>
      <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="email" 
          placeholder="Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '10px', borderRadius: '5px', background: '#333', color: 'white', border: 'none' }}
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '10px', borderRadius: '5px', background: '#333', color: 'white', border: 'none' }}
          required 
        />
        <button type="submit" style={{ padding: '10px', background: '#22d3ee', color: 'black', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          {isLogin ? 'Login' : 'Sign Up'}
        </button>
      </form>
      <button 
        onClick={() => setIsLogin(!isLogin)}
        style={{ marginTop: '20px', background: 'transparent', border: 'none', color: '#22d3ee', cursor: 'pointer', textDecoration: 'underline' }}
      >
        {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
      </button>
    </div>
  );
}
