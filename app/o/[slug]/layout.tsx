export default function PublicLocalOrganizationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        .local-page {
          --kofc-knight-navy: #112866;
          --kofc-knight-navy-dark: #071a4d;
          --kofc-knight-gold: #f7b718;
          --kofc-knight-gold-dark: #e2a501;
          --kofc-insurance-blue: #0277d9;
          --kofc-header-glow: #2369ab;
          --kofc-ice: #d7e4f1;
          --kofc-ice-light: #ebf1f8;
        }

        .local-page .local-page-hero {
          color: white;
          background:
            radial-gradient(50% 50% at 18% 10%, rgba(35, 105, 171, 0.95) 0%, rgba(35, 105, 171, 0.35) 34%, transparent 68%),
            linear-gradient(129deg, var(--kofc-knight-navy-dark) 38.83%, var(--kofc-insurance-blue) 107.53%);
          border-bottom-color: rgba(247, 183, 24, 0.38);
        }

        .local-page .local-page-hero p {
          color: rgba(255, 255, 255, 0.86);
        }

        .local-page .local-page-hero .qv-button-primary {
          background: var(--kofc-knight-gold);
          border-color: var(--kofc-knight-gold);
          color: var(--kofc-knight-navy-dark);
          box-shadow: 0 14px 30px rgba(7, 26, 77, 0.22);
        }

        .local-page .local-page-story-visual {
          border-color: rgba(247, 183, 24, 0.42);
        }

        .local-page .local-page-contact-copy {
          border-color: rgba(17, 40, 102, 0.16);
          background:
            radial-gradient(circle at 92% 8%, rgba(255, 255, 255, 0.6), transparent 26%),
            linear-gradient(135deg, var(--kofc-ice-light) 0%, var(--kofc-ice) 100%);
        }

        .local-page .local-page-contact-links .qv-button-secondary {
          border-color: var(--kofc-knight-navy);
          color: var(--kofc-knight-navy);
        }

        .local-page .local-page-contact-links .qv-button-secondary:hover,
        .local-page .local-page-contact-links .qv-button-secondary:focus-visible {
          border-color: var(--kofc-knight-gold-dark);
          color: var(--kofc-knight-navy-dark);
        }

        .local-page footer {
          background: var(--kofc-knight-navy-dark);
          border-top: 4px solid var(--kofc-knight-gold);
        }
      `}</style>
    </>
  )
}
