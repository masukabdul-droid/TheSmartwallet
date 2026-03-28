import { Outlet } from "react-router-dom";
import { DesktopSidebar, MobileNav } from "./AppSidebar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar — visible md and up */}
      <DesktopSidebar />

      {/* Mobile top bar + drawer — visible below md */}
      <MobileNav />

      {/* Main content area */}
      <main className="
        md:ml-[240px]
        transition-all duration-300
        pt-14 md:pt-0
      ">
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
