import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { LagosScene } from "@/components/brand/LagosScene";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BuiltByFooter } from "@/components/layout/BuiltByFooter";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <LagosScene>
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
        <BrandLogo />
      <div className="text-center">
          <h1 className="brush-display mb-4 mt-8 text-6xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
        <BuiltByFooter />
      </div>
    </LagosScene>
  );
};

export default NotFound;
