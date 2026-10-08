import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// This is a PUBLIC browser key, never a service-role or secret key.
const SUPABASE_URL = 'https://ohwrtspcxwafkgupseqz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_oJAhMieLNlzIKZk6Jo36Xg_kxWAI09I';

const status = document.getElementById('status');
const form = document.getElementById('reset-form');
const button = document.getElementById('submit-button');
const show = (message, kind = '') => {
  status.textContent = message;
  status.className = kind;
};

async function initialize() {
  if (SUPABASE_PUBLISHABLE_KEY.startsWith('PASTE_')) {
    show('Website setup is incomplete. Please contact Readily support.', 'error');
    return;
  }

  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const get = key => hash.get(key) || query.get(key);
  const error = get('error_description') || get('error');
  if (error) {
    show('This reset link is invalid or expired. Request a new one in Readily.', 'error');
    return;
  }

  // Remove recovery credentials from the visible URL and browser history.
  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  const tokenHash = get('token_hash');
  const type = get('type');
  const code = get('code');
  window.history.replaceState(null, '', window.location.pathname);

  if (type && type !== 'recovery') {
    show('This link is not a password-reset link.', 'error');
    return;
  }
  if (!(accessToken && refreshToken) && !(tokenHash && type === 'recovery') && !code) {
    show('No valid reset credentials were found. Request a new link in Readily.', 'error');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { detectSessionInUrl: false, persistSession: false, autoRefreshToken: false },
  });

  try {
    let result;
    if (accessToken && refreshToken) {
      result = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    } else if (tokenHash && type === 'recovery') {
      result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    } else {
      result = await supabase.auth.exchangeCodeForSession(code);
    }
    if (result.error) throw result.error;
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new Error('Session unavailable');
    show('Link verified. Enter your new password.');
    form.hidden = false;
  } catch (_) {
    show('This reset link is invalid or expired. Request a new link in Readily.', 'error');
    return;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const password = document.getElementById('password').value;
    const confirmation = document.getElementById('confirm-password').value;
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      show('Use at least 10 characters with uppercase, lowercase, a number, and a special character.', 'error');
      return;
    }
    if (password !== confirmation) {
      show('Passwords do not match.', 'error');
      return;
    }
    button.disabled = true;
    show('Saving your new password…');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      show(updateError.message || 'Could not update password. Please try again.', 'error');
      button.disabled = false;
      return;
    }
    form.hidden = true;
    show('Password updated! Return to Readily and sign in with your new password.', 'success');
    await supabase.auth.signOut();
  });
}

initialize().catch(() => show('Unable to load the reset page. Please try again later.', 'error'));
