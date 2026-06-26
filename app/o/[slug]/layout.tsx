export default function PublicLocalOrganizationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        .local-page .local-page-hero {
          color: white;
          background:
            radial-gradient(circle at 83% 18%, rgba(245, 200, 75, 0.34), transparent 34%),
            radial-gradient(circle at 18% 92%, rgba(214, 173, 59, 0.18), transparent 30%),
            linear-gradient(135deg, #031b3d 0%, #082a5a 56%, #123e78 100%) !important;
          border-bottom-color: rgba(214, 173, 59, 0.36) !important;
        }

        .local-page .local-page-hero p {
          color: rgba(255, 255, 255, 0.86) !important;
        }

        .local-page .local-page-hero .qv-button-primary {
          background: #f5c84b !important;
          border-color: #f5c84b !important;
          color: #15121c !important;
          box-shadow: 0 14px 30px rgba(3, 27, 61, 0.22);
        }

        .local-page .local-page-story-visual {
          border-color: rgba(214, 173, 59, 0.42) !important;
        }

        .local-page footer {
          background: #031b3d !important;
          border-top: 4px solid #d6ad3b;
        }
      `}</style>
    </>
  )
}
