export const metadata = { title: "Teltrip Dashboard" };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{margin:0,fontFamily:"system-ui",background:"#0b1020",color:"#e9edf5"}}>
        {children}
      </body>
    </html>
  );
}