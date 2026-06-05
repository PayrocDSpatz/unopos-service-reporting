export const metadata = {
  title: 'UNOPOS Overnight Report Generator',
  description: 'Upload HESK export and generate an email-ready overnight support summary.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Arial, sans-serif', margin: 0, background: '#f6f7fb' }}>
        {children}
      </body>
    </html>
  );
}
