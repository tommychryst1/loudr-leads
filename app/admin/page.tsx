import type { Metadata } from "next";
import Brand from "@/components/Brand";
import AdminPricing from "@/components/AdminPricing";
import "./admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "State pricing | LOUDR Admin", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <div className="site-shell admin-shell">
      <a href="#state-pricing" className="skip-link">Skip to state pricing</a>
      <header className="site-header">
        <Brand />
        <a href="/" className="admin-entry-button">Back to checkout</a>
      </header>
      <main id="state-pricing" className="admin-main">
        <p className="eyebrow"><span className="eyebrow-line" /> Admin</p>
        <h1>State pricing<span className="accent-text">.</span></h1>
        <p className="admin-intro">Update the price per lead for each state. Saved changes apply to new checkouts.</p>
        <AdminPricing />
      </main>
      <footer className="site-footer"><span>© {new Date().getFullYear()} LOUDR Media</span><span>Lead pricing</span></footer>
    </div>
  );
}
