// ponytail: compact demo data (3 tasks/day); replace with your own timetable anytime
const D: [string, string, string][] = [
  ["Linux Fundamentals", "Get comfortable in the Linux terminal", "Learn filesystem navigation|Learn users, groups and permissions|Practice 20 core terminal commands"],
  ["Networking Fundamentals", "Understand TCP/IP fundamentals", "Learn TCP vs UDP|Learn ports and DNS|Capture traffic in Wireshark lab"],
  ["HTTP Essentials", "Understand how the web works", "Learn HTTP methods and status codes|Inspect requests in devtools|Study cookies and sessions"],
  ["Recon Fundamentals", "Learn passive reconnaissance", "Practice passive recon techniques|Enumerate subdomains in lab|Document findings in notes"],
  ["Nmap Basics", "Scan networks in an authorized lab", "Learn Nmap scan types|Scan a lab target|Save and compare scan output"],
  ["Wireshark Basics", "Analyze traffic captures", "Learn capture filters|Learn display filters|Follow a TCP stream"],
  ["Burp Suite Setup", "Configure Burp for lab use", "Install and configure Burp|Scope a lab target|Intercept and forward a request"],
  ["Web Proxies", "Route lab traffic through Burp", "Map a lab app with Spider|Repeat requests with Repeater|Log findings"],
  ["OWASP Top 10 Tour", "Know the major web risk classes", "Read the OWASP Top 10|Map each risk to a lab|Pick one risk to study deeper"],
  ["HTML Injection and XSS 1", "Understand reflected XSS in labs", "Learn how reflected XSS works|Exploit it in a vulnerable lab|Test basic filter bypasses"],
  ["HTML Injection and XSS 2", "Understand stored XSS in labs", "Learn how stored XSS works|Exploit it in a vulnerable lab|Study output encoding defenses"],
  ["SQL Injection 1", "Understand in-band SQLi in labs", "Learn how SQL queries break|Exploit UNION-based SQLi in lab|Enumerate a lab database"],
  ["SQL Injection 2", "Understand blind SQLi in labs", "Learn boolean-based blind SQLi|Learn time-based blind SQLi|Practice in a vulnerable lab"],
  ["Authentication Attacks", "Test logins in authorized labs", "Study brute-force protections|Test default credentials in lab|Study MFA bypass theory"],
  ["Authorization and IDOR", "Find access-control flaws in labs", "Learn horizontal vs vertical escalation|Test an IDOR in a lab|Write an impact note"],
  ["Command Injection", "Understand OS command injection in labs", "Learn how input reaches shells|Exploit command injection in lab|Study allow-list defenses"],
  ["Path Traversal", "Understand file-access flaws in labs", "Learn traversal payloads|Read a lab file via traversal|Study sandboxing defenses"],
  ["SSRF Basics", "Understand server-side request forgery in labs", "Learn common SSRF vectors|Exploit SSRF in a lab|Study egress filtering"],
  ["File Upload Flaws", "Test uploads in authorized labs", "Study upload validation flaws|Bypass extension checks in lab|Study safe storage patterns"],
  ["Linux Privilege Escalation 1", "Enumerate a Linux lab host", "Run enumeration scripts in lab|Find SUID binaries|Check sudo misconfigurations"],
  ["Linux Privilege Escalation 2", "Escalate in a Linux lab", "Exploit a weak cron job in lab|Abuse a writable PATH in lab|Document the escalation path"],
  ["Windows Privilege Escalation 1", "Enumerate a Windows lab host", "Learn Windows recon commands|Find unquoted service paths|Check AlwaysInstallElevated"],
  ["Windows Privilege Escalation 2", "Escalate in a Windows lab", "Abuse a weak service in lab|Harvest lab credentials safely|Document the escalation path"],
  ["Password and Hash Fundamentals", "Handle credentials safely in labs", "Learn hashing vs encryption|Crack lab hashes with wordlists|Study password policy design"],
  ["Metasploit Basics", "Use Metasploit in authorized labs", "Learn modules and payloads|Exploit a lab target|Manage sessions cleanly"],
  ["Python Security Scripting", "Automate lab recon with Python", "Script HTTP requests in Python|Parse Nmap output|Build a small port scanner for labs"],
  ["Bash Automation", "Automate lab workflows with Bash", "Write a recon helper script|Loop over lab targets|Log script output to files"],
  ["CTF Practice Day", "Solve lab challenges end to end", "Solve 3 beginner lab machines|Write up one solution|Note techniques to revisit"],
  ["Reporting", "Write a professional-style lab report", "Draft an executive summary|Document findings with severity|Add remediation advice"],
  ["Final Assessment", "Prove the 30-day lab skills", "Complete the capstone lab set|Review all month notes|Plan the next 30 days"],
];

export function demoTimetable(): string {
  const out = ["PLAN: 30-Day Ethical Hacking Trainee", "DURATION: 30 days", ""];
  D.forEach(([topic, goal, tasks], i) => {
    out.push(`DAY ${i + 1}`, `TOPIC: ${topic}`, `GOAL: ${goal}`, "TIME: 3h", "", "TASKS:");
    for (const t of tasks.split("|")) out.push(`- ${t}`);
    out.push("", "RESOURCES:", `- https://example.com/day-${i + 1}`);
    if (i < D.length - 1) out.push("", "");
  });
  return out.join("\n") + "\n";
}
