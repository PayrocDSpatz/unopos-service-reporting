const highlightTerms = [
  'internet', 'outage', 'network down', 'wifi', 'router', 'switch',
  'emv', 'card reader', 'chipper', 'pax', 'terminal', 'credit card machine',
  'doesn\'t turn on', 'not turn on', 'cannot process', 'declined', 'batch',
  'online order', 'online ordering', 'wrong dish', 'wrong item', 'external name',
  'integration', 'owner.com', 'doordash', 'uber eats', 'grubhub',
  'dispute', 'chargeback', 'refund', 'duplicate charge',
  'escalated', 'replacement', 'serial number', 'call back', 'investigate',
  'in process', 'pending', 'waiting'
];

const routineTerms = [
  'end of day', 'report request', 'password', 'basic menu', 'training', 'cash discount clarification'
];

export function shouldHighlight(ticket) {
  const text = [ticket.subject, ticket.issue, ticket.notes, ticket.status, ticket.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (ticket.assignedTo === 'Unassigned') return true;
  if ((ticket.priority || '').toLowerCase().includes('high')) return true;
  if (highlightTerms.some(term => text.includes(term))) return true;

  return false;
}

export function inferBusinessImpact(ticket) {
  const text = [ticket.subject, ticket.issue, ticket.notes].filter(Boolean).join(' ').toLowerCase();
  if (text.includes('internet') || text.includes('network')) return 'Possible disruption to POS connectivity, payment processing, and online ordering.';
  if (text.includes('emv') || text.includes('card reader') || text.includes('pax') || text.includes('terminal')) return 'Potential impact to card acceptance and restaurant checkout flow.';
  if (text.includes('online order') || text.includes('online ordering')) return 'Customer-facing issue that may impact orders, refunds, or guest satisfaction.';
  if (text.includes('dispute') || text.includes('chargeback')) return 'Merchant financial/risk issue requiring timely review.';
  if (text.includes('integration')) return 'Third-party integration dependency; may require coordination outside support.';
  return 'Operational follow-up recommended based on ticket content or status.';
}

export function needsFollowUp(ticket) {
  const status = (ticket.status || '').toLowerCase();
  const text = [ticket.notes, ticket.subject, ticket.issue].filter(Boolean).join(' ').toLowerCase();
  if (ticket.assignedTo === 'Unassigned') return true;
  if (['new', 'open', 'replied'].some(s => status.includes(s)) && !text.includes('resolved')) return true;
  return ['follow', 'call back', 'investigate', 'escalated', 'replacement', 'pending', 'waiting', 'in process'].some(term => text.includes(term));
}
