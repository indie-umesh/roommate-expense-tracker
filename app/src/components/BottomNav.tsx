import React from "react";
import { Plus, Home, Table, CreditCard, Users } from "lucide-react";

export type NavTab = "activity" | "sheet" | "settle" | "members";

interface BottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenAddModal: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  onOpenAddModal,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto pointer-events-none px-4 pb-4 md:hidden">
      <div className="pointer-events-auto bg-[#121826]/92 backdrop-blur-2xl border border-white/15 rounded-full p-2 shadow-[0_10px_35px_rgba(0,0,0,0.5)] flex items-center justify-between">
        {/* Tab 1: Activity */}
        <button
          onClick={() => onChangeTab("activity")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-95 cursor-pointer ${
            activeTab === "activity"
              ? "text-emerald-400"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold tracking-tight">Home</span>
        </button>

        {/* Tab 2: Sheet */}
        <button
          onClick={() => onChangeTab("sheet")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-95 cursor-pointer ${
            activeTab === "sheet"
              ? "text-emerald-400"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Table className="w-5 h-5" />
          <span className="text-[10px] font-bold tracking-tight">Sheet</span>
        </button>

        {/* Center Raised Action Button: + Add */}
        <div className="px-1 -mt-5">
          <button
            onClick={onOpenAddModal}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 flex items-center justify-center shadow-[0_6px_22px_rgba(16,185,129,0.55)] active:scale-90 transition-transform duration-150 border-3 border-[#0b0f19] cursor-pointer"
            title="Add Expense"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* Tab 3: Settle */}
        <button
          onClick={() => onChangeTab("settle")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-95 cursor-pointer ${
            activeTab === "settle"
              ? "text-emerald-400"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px] font-bold tracking-tight">Settle</span>
        </button>

        {/* Tab 4: Members */}
        <button
          onClick={() => onChangeTab("members")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-95 cursor-pointer ${
            activeTab === "members"
              ? "text-emerald-400"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-bold tracking-tight">Mates</span>
        </button>
      </div>
    </div>
  );
};
