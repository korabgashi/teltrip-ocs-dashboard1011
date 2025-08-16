export const metadata = { title: "Teltrip Dashboard" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui,-apple-system,Segoe UI,Roboto",
          background: "#f8ffe6",   // brighter background
          color: "#000"            // black font
        }}
      >
        {children}
      </body>
    </html>
  );
}
