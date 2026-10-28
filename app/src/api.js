export async function api(path, body, method = 'POST', signal) {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : {
      'Content-Type': 'application/json',
      'X-Jakh-Client': 'local-app'
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to complete this action.');
  return result;
}
export const numberText = value => {
  if (value === null) return 'Not available';
  const [integer, fraction] = String(value).split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction && !/^0+$/.test(fraction) ? '.' + fraction : '');
};
export const amount = (value, currency = 'AED') => value === null ? 'Not available' : `${currency} ${numberText(value)}`;
export const compact = (value, currency = 'AED') => value === null ? 'Not available' : `${currency} ${Number(value) >= 1000000 ? (Number(value) / 1000000).toFixed(1) + 'm' : Number(value).toLocaleString('en-GB')}`;
export const stateLabel = {
  draft: 'Draft',
  submitted: 'Awaiting approval',
  approved: 'Approved for sourcing',
  returned: 'Returned for changes'
};
export const dueLabel = value => value === '2026-10-28' ? 'Today' : value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC'
}) : 'Not set';
