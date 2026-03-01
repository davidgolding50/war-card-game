import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "War Card Game",
  description: "Play classic War against the computer"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Script id="suppress-extension-solana-error" strategy="beforeInteractive">
          {`(function () {
  var blocked = "Cannot assign to read only property 'solana'";
  function isBlocked(message, source) {
    var msg = String(message || "");
    var src = String(source || "");
    return msg.indexOf(blocked) !== -1 || (src.indexOf("chrome-extension://") === 0 && msg.toLowerCase().indexOf("solana") !== -1);
  }

  window.addEventListener(
    "error",
    function (event) {
      if (isBlocked(event.message, event.filename)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    function (event) {
      var reason = event.reason;
      var message = typeof reason === "string" ? reason : reason && reason.message ? reason.message : "";
      if (isBlocked(message, "")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  var previousOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    if (isBlocked(message, source)) {
      return true;
    }
    if (typeof previousOnError === "function") {
      return previousOnError(message, source, lineno, colno, error);
    }
    return false;
  };
})();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
