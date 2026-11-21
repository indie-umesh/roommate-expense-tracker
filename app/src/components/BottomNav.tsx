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
      <div className="pointer-events-auto bg-white/95 dark:bg-[#121826]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-white/10 rounded-full p-2 shadow-[0_10px_35px_rgba(0,0,0,0.12),0_4px_0_0_#e2e8f0] dark:shadow-[0_12px_40px_rgba(0,0,0,0.7),0_4px_0_0_#090d16] flex items-center justify-between">
        {/* Tab 1: Activity */}
        <button
          onClick={() => onChangeTab("activity")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-95 cursor-pointer ${
            activeTab === "activity"
              ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
              ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Table className="w-5 h-5" />
          <span className="text-[10px] font-bold tracking-tight">Sheet</span>
        </button>

        {/* Center Raised 3D Action Button: + Add */}
        <div className="px-1 -mt-6">
          <button
            onClick={onOpenAddModal}
            className="w-14 h-14 rounded-full btn-3d-indigo text-white flex items-center justify-center border-4 border-white dark:border-[#090d16] cursor-pointer"
            title="Add Expense"
          >
            <Plus className="w-7 h-7 stroke-[3]" />
          </button>
        </div>

        {/* Tab 3: Settle */}
        <button
          onClick={() => onChangeTab("settle")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-95 cursor-pointer ${
            activeTab === "settle"
              ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
              ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-bold tracking-tight">Mates</span>
        </button>
      </div>
    </div>
  );
};
