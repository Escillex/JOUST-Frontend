import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-component-background border-t border-component-border py-16 px-8 mt-auto relative z-20">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Image src="/hpluslogo.png" width={64} height={64} alt="Hobby+ Logo" style={{ height: 'auto' }} />
          </div>
          <p className="text-sm text-neutral-500 leading-relaxed max-w-xs">
            The ultimate platform for competitive hobby gaming. Join tournaments, track stats, and grow your community.
          </p>
        </div>

        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6">Navigation</h4>
          <ul className="space-y-4 text-sm text-neutral-400">
            <li><Link href="/" className="hover:text-primary transition-colors">Home</Link></li>
            <li><Link href="/tournaments" className="hover:text-primary transition-colors">Tournaments</Link></li>
            <li><Link href="/leaderboards" className="hover:text-primary transition-colors">Leaderboards</Link></li>
            <li><Link href="/shop" className="hover:text-primary transition-colors">Shop</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6">Legal</h4>
          <ul className="space-y-4 text-sm text-neutral-400">
            <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
            <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
            <li><Link href="/cookies" className="hover:text-primary transition-colors">Cookie Policy</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6">Contact</h4>
          <p className="text-sm text-neutral-400 mb-4">Questions? Reach out to our support team.</p>
          <a href="mailto:support@hobbyplus.com" className="text-sm font-bold text-white hover:text-primary transition-colors italic underline decoration-primary/30 underline-offset-4">support@hobbyplus.com</a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-16 mt-16 border-t border-component-border flex flex-col md:flex-row justify-between items-center gap-8">
        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
          © {new Date().getFullYear()} Hobby+ Technologies. All Rights Reserved.
        </p>
        <div className="flex gap-6 text-neutral-600">
          <span className="text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors cursor-pointer">Twitter</span>
          <span className="text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors cursor-pointer">Discord</span>
          <span className="text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors cursor-pointer">Instagram</span>
        </div>
      </div>
    </footer>
  );
}
