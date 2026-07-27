import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Icon } from "../../components/primitives/Icon";

type Doc = { title: string; updated: string; intro: string; sections: { h: string; p: string }[] };

const DOCS: Record<string, Doc> = {
  privacy: {
    title: "Privacy Policy",
    updated: "July 2026",
    intro:
      "This policy explains what information Fifth Avenue collects, how we use it, and the choices you have. It applies to our website, the client dashboard and our campaign services.",
    sections: [
      { h: "Information we collect", p: "Account and contact details you provide, campaign and billing data you submit through the dashboard, and standard usage analytics collected to keep the product secure and reliable." },
      { h: "How we use it", p: "To operate campaigns, provide analytics and reporting, process invoices, and communicate about your account. We do not sell personal data." },
      { h: "Sharing", p: "We share data only with processors that help us run the service (hosting, payments, communications) under contract, and where required by law." },
      { h: "Your rights", p: "You may request access, correction or deletion of your personal data at any time by contacting privacy@fifth-avenue.in." },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "July 2026",
    intro:
      "These terms govern your use of Fifth Avenue's website and client dashboard, and the marketing services we provide under individual statements of work.",
    sections: [
      { h: "Use of the service", p: "You agree to use the dashboard only for lawful purposes and in line with any campaign agreement in force between us." },
      { h: "Deliverables & approvals", p: "Campaign deliverables, timelines and budgets are set out in each statement of work and tracked through the dashboard's approval flow." },
      { h: "Fees", p: "Retainers and campaign invoices are billed as agreed. Late payments may pause active work until settled." },
      { h: "Liability", p: "The service is provided on a commercially reasonable basis. Our aggregate liability is limited to the fees paid for the relevant engagement." },
    ],
  },
  security: {
    title: "Security",
    updated: "July 2026",
    intro:
      "We take the security of client campaign and billing data seriously. This page summarises the controls we operate.",
    sections: [
      { h: "Data in transit & at rest", p: "All traffic is encrypted in transit. Sensitive data is encrypted at rest with managed keys." },
      { h: "Access control", p: "Role-based access limits who can view or change campaigns, analytics and billing. Owner, manager and content roles scope every action." },
      { h: "Monitoring", p: "We log access to sensitive resources and review activity for anomalies." },
      { h: "Reporting an issue", p: "Found a vulnerability? Email security@fifth-avenue.in and we'll respond promptly." },
    ],
  },
  gst: {
    title: "GST & Billing",
    updated: "July 2026",
    intro:
      "Details on how Fifth Avenue handles GST and invoicing for Indian clients.",
    sections: [
      { h: "GST registration", p: "Fifth Avenue is a GST-registered entity in India. Our GSTIN appears on every invoice." },
      { h: "Invoices", p: "Retainer and campaign invoices are issued through the dashboard's Billing section with a full line-item breakdown and applicable GST." },
      { h: "Input credit", p: "GST charged is eligible for input tax credit where permitted, using the GSTIN on your invoices." },
      { h: "Questions", p: "For billing or GST queries, contact billing@fifth-avenue.in." },
    ],
  },
};

export default function LegalPage() {
  const { doc = "privacy" } = useParams();
  const d = DOCS[doc] ?? DOCS.privacy;

  return (
    <div className="mx-auto max-w-[760px] px-6 pb-24 pt-28 md:px-10">
      <Link to="/" className="inline-flex items-center gap-1.5 text-caption text-ink-3 transition-colors hover:text-ink">
        <Icon icon={ArrowLeft} size={14} /> Back to home
      </Link>

      <div className="mt-6 border-b border-line pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">Legal</p>
        <h1 className="mt-2 font-display text-title-lg font-semibold text-ink">{d.title}</h1>
        <p className="mt-1 text-caption text-ink-3">Last updated {d.updated}</p>
      </div>

      <p className="mt-6 text-body text-ink-2">{d.intro}</p>

      <div className="mt-8 space-y-7">
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-body-lg font-semibold text-ink">{s.h}</h2>
            <p className="mt-2 text-body text-ink-2">{s.p}</p>
          </section>
        ))}
      </div>

      {/* sibling legal docs */}
      <div className="mt-12 flex flex-wrap gap-2 border-t border-line pt-6">
        {Object.entries(DOCS).map(([key, val]) => (
          <Link
            key={key}
            to={`/legal/${key}`}
            className={`rounded-full border px-3 py-1 text-caption transition-colors ${
              key === doc ? "border-accent/40 bg-accent-muted text-accent" : "border-line text-ink-2 hover:text-ink"
            }`}
          >
            {val.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
