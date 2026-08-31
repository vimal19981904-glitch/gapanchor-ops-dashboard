import 'isomorphic-fetch';
import { Client } from '@microsoft/microsoft-graph-client';

export function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export async function fetchOutlookEmails(
  accessToken: string,
  searchQuery: string = 'invoice OR payment OR receipt OR quotation',
  top: number = 20
) {
  const client = createGraphClient(accessToken);
  try {
    const messages = await client
      .api('/me/messages')
      .search(searchQuery)
      .top(top)
      .select('id,subject,from,receivedDateTime,bodyPreview,hasAttachments')
      .orderby('receivedDateTime desc')
      .get();
    return messages.value || [];
  } catch (error) {
    console.error('Graph API mail fetch error:', error);
    return [];
  }
}

export async function fetchCalendarEvents(
  accessToken: string,
  startDate?: string,
  endDate?: string
) {
  const client = createGraphClient(accessToken);
  const now = new Date();
  const start = startDate || new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
  const end = endDate || new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

  try {
    const events = await client
      .api('/me/calendarView')
      .query({ startDateTime: start, endDateTime: end })
      .select('id,subject,start,end,location,attendees,organizer')
      .orderby('start/dateTime')
      .top(50)
      .get();
    return events.value || [];
  } catch (error) {
    console.error('Graph API calendar fetch error:', error);
    return [];
  }
}

export function parseEmailForFinance(email: any): {
  isFinanceRelated: boolean;
  type?: 'income' | 'expense';
  amount?: number;
  subject?: string;
  from?: string;
  date?: string;
} {
  const subject = (email.subject || '').toLowerCase();
  const preview = (email.bodyPreview || '').toLowerCase();
  const combined = `${subject} ${preview}`;

  const financeKeywords = ['invoice', 'payment', 'receipt', 'quotation', 'amount', 'paid', 'transfer', 'upi', 'neft', 'fee'];
  const isFinanceRelated = financeKeywords.some(kw => combined.includes(kw));

  if (!isFinanceRelated) return { isFinanceRelated: false };

  const amountMatch = combined.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{2})?)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined;

  const isExpense = ['expense', 'bill', 'subscription', 'charge', 'debit'].some(kw => combined.includes(kw));

  return {
    isFinanceRelated: true,
    type: isExpense ? 'expense' : 'income',
    amount,
    subject: email.subject,
    from: email.from?.emailAddress?.address,
    date: email.receivedDateTime,
  };
}

export async function fetchDemoEnquiries(accessToken: string) {
  const client = createGraphClient(accessToken);
  try {
    const foldersResponse = await client.api('/me/mailFolders').filter("displayName eq 'Demo enquiry!'").get();
    const folder = foldersResponse.value?.[0];
    
    if (!folder) {
      console.warn('Outlook folder "Demo enquiry!" not found.');
      return [];
    }

    const messages = await client
      .api(`/me/mailFolders/${folder.id}/messages`)
      .select('id,subject,from,receivedDateTime,bodyPreview')
      .orderby('receivedDateTime desc')
      .top(50)
      .get();
      
    return messages.value || [];
  } catch (error) {
    console.error('Graph API demo enquiries fetch error:', error);
    return [];
  }
}
