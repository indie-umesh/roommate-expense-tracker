import React from "react";
import { Plus, Home, Table, CreditCard, Users } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

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
  const { t } = useLanguage();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto pointer-events-none px-4 pb-4 md:hidden">
      <div className="pointer-events-auto bg-white/95 dark:bg-[#121826]/95 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl p-2 shadow-lg flex items-center justify-between">
        {/* Tab 1: Activity */}
        <button
          onClick={() => onChangeTab("activity")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "activity"
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">{t("home")}</span>
        </button>

        {/* Tab 2: Sheet */}
        <button
          onClick={() => onChangeTab("sheet")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "sheet"
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <Table className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">{t("sheet")}</span>
        </button>

        {/* Center Raised Action Button: + Add */}
        <div className="px-1 -mt-6">
          <button
            type="button"
            onClick={onOpenAddModal}
            style={{ touchAction: "manipulation" }}
            className="w-13 h-13 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white flex items-center justify-center border-4 border-white dark:border-[#090d16] shadow-md transition cursor-pointer touch-manipulation select-none"
            title={t("add_expense")}
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab 3: Settle */}
        <button
          onClick={() => onChangeTab("settle")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "settle"
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">{t("settle")}</span>
        </button>

        {/* Tab 4: Members */}
        <button
          onClick={() => onChangeTab("members")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "members"
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">{t("roommates")}</span>
        </button>
      </div>
    </div>
  );
};
