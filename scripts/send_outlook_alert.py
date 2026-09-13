import sys
import json

def send_mail(to_email, subject, html_body, importance=2):
    try:
        import win32com.client
        import pythoncom
        pythoncom.CoInitialize()
        outlook = win32com.client.Dispatch("Outlook.Application")
        mail = outlook.CreateItem(0)  # 0 = olMailItem
        mail.To = to_email
        mail.Subject = subject
        mail.HTMLBody = html_body
        mail.Importance = 2  # 2 = olImportanceHigh (High Importance flag in Outlook)
        mail.Send()
        print(json.dumps({"success": True, "message": f"High-importance email successfully dispatched via local Outlook to {to_email}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    to = None
    subj = None
    body = None

    # Check if JSON payload provided via stdin
    try:
        if not sys.stdin.isatty():
            raw = sys.stdin.read()
            if raw and raw.strip():
                data = json.loads(raw)
                to = data.get("to")
                subj = data.get("subject")
                body = data.get("html")
    except Exception as parse_err:
        pass

    if not to and len(sys.argv) > 1:
        to = sys.argv[1]
    if not subj and len(sys.argv) > 2:
        subj = sys.argv[2]
    if not body and len(sys.argv) > 3:
        body = sys.argv[3]

    to = to or "avpartners.consultants@outlook.com"
    subj = subj or "[URGENT] Lead Follow-up Required - Karandeep Singh"
    body = body or "<h3>Test Alert</h3>"

    send_mail(to, subj, body)
