import React, { FunctionComponent } from "react";
import Head from "next/head";

import RegexPlayground from "../components/RegexPlayground";

const Home: FunctionComponent = () => {
  return (
    <div>
      <Head>
        <title>Regex Playground</title>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Poppins:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="min-h-screen flex flex-col bg-theme_gray max-w-full">
        <main className="flex flex-col w-full px-4 sm:px-6 lg:px-10 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center pb-6 gap-4">
            <div>
              <h1 className="text-theme_slateBlue font-semibold text-2xl">
                Regex Playground
              </h1>
              <p className="text-sm text-theme_textGray">
                Write, test, and debug regular expressions in a safe, fast, and
                deterministic environment.
              </p>
            </div>
          </div>
          <RegexPlayground />
        </main>
        <footer className="bg-gradient-to-br to-theme_slateBlue from-theme_hotPink py-4 mt-auto w-full">
          <div className="text-center text-white text-sm">
            Regex Playground • Client-side only
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
