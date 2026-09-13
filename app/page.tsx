'use client';

import React, { useState, useEffect } from 'react';
import DashboardHeader from '@/components/DashboardHeader';
import StatCard from '@/components/StatCard';
import FinanceCard from '@/components/FinanceCard';
import FinanceModal from '@/components/FinanceModal';
import OpsCard from '@/components/OpsCard';
import OpsModal from '@/components/OpsModal';
import CommsCard from '@/components/CommsCard';
import DevProgressCard from '@/components/DevProgressCard';
import DevModal from '@/components/DevModal';
import SetupModal from '@/components/SetupModal';
import EnquiryModal from '@/components/EnquiryModal';
import CalendarWidget from '@/components/CalendarWidget';
import { SkeletonKPI } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, Calendar, MessageSquare, Code2 } from 'lucide-react';

export default function Dashboard() {
  const [financeData, setFinanceData] = useState<any>(null);
  const [opsData, setOpsData] = useState<any>(null);
  const [commsData, setCommsData] = useState<any>(null);
  const [devData, setDevData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);
  const [isOpsModalOpen, setIsOpsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);

  // Setup Modal
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [setupInitialTab, setSetupInitialTab] = useState<'meta' | 'microsoft'>('meta');

  const handleOpenAddSession = () => {
    setEditingSession(null);
    setIsOpsModalOpen(true);
  };

  const handleOpenEditSession = (session: any) => {
    setEditingSession(session);
    setIsOpsModalOpen(true);
  };

  const fetchAllData = async () => {
    try {
      const [finRes, opsRes, commsRes, devRes] = await Promise.all([
        fetch('/api/finance'),
        fetch('/api/ops'),
        fetch('/api/comms'),
        fetch('/api/dev'),
      ]);

      const [finJson, opsJson, commsJson, devJson] = await Promise.all([
        finRes.json(), opsRes.json(), commsRes.json(), devRes.json(),
      ]);

      if (finJson.success) setFinanceData(finJson);
      if (opsJson.success) setOpsData(opsJson);
      if (commsJson.success) setCommsData(commsJson);
      if (devJson.success) setDevData(devJson);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAllData(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/comms/sync', { method: 'POST' });
    } catch (err) {
      console.error('Failed to sync Outlook enquiries:', err);
    }
    fetchAllData();
  };

  const handleOpenSetup = (tab: 'meta' | 'microsoft') => {
    setSetupInitialTab(tab);
    setIsSetupModalOpen(true);
  };

  const totalIncome = financeData?.summary?.totalIncome || 0;
  const totalExpense = financeData?.summary?.totalExpense || 0;
  const netProfit = financeData?.summary?.netProfit || 0;
  const totalSessions = opsData?.summary?.totalSessions || 0;
  const totalParticipants = opsData?.summary?.totalParticipants || 0;
  const enquiryTotal = commsData?.summary?.total || 0;
  const actionCount = commsData?.summary?.actionRequiredCount || 0;
  const devCount = devData?.updates?.length || 0;

  return (
    <div className="w-full max-w-full overflow-x-hidden px-2.5 sm:px-6 md:px-8 py-2.5 sm:py-6">
      <DashboardHeader
        onRefresh={handleRefresh}
        isRefreshing={refreshing}
        graphStatus={financeData?.graphApiStatus}
        whatsappStatus={commsData?.whatsappConfig}
        onOpenSetup={handleOpenSetup}
      />

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-5 mb-3 sm:mb-7">
        {loading ? (
          <>
            <SkeletonKPI />
            <SkeletonKPI />
            <SkeletonKPI />
            <SkeletonKPI />
          </>
        ) : (
          <>
            <StatCard
              title="Net Revenue"
              value={formatCurrency(netProfit)}
              subtext={`Inc: ${formatCurrency(totalIncome)} • Exp: ${formatCurrency(totalExpense)}`}
              icon={DollarSign}
              trend="up"
              trendValue="+18.4%"
              color="emerald"
            />
            <StatCard
              title="Training Ops"
              value={`${totalSessions} Sessions`}
              subtext={`${totalParticipants} Participants Across SCM`}
              icon={Calendar}
              trend="up"
              trendValue="Manhattan/BY"
              color="indigo"
            />
            <StatCard
              title="WhatsApp Leads"
              value={`${enquiryTotal} Total`}
              subtext={actionCount > 0 ? `${actionCount} pending action` : 'All processed'}
              icon={MessageSquare}
              trend={actionCount > 0 ? 'down' : 'up'}
              trendValue={actionCount > 0 ? `${actionCount} Action` : '✓ All clear'}
              color={actionCount > 0 ? 'amber' : 'cyan'}
            />
            <StatCard
              title="Dev Progress"
              value={`${devCount} Shipped`}
              subtext="Features, Fixes & Infra"
              icon={Code2}
              trend="up"
              trendValue="Q3 Active"
              color="amber"
            />
          </>
        )}
      </div>

      {/* Main Module Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-6">
        {/* Finance Module (Full Width) */}
        <FinanceCard
          financeData={financeData}
          onOpenModal={() => setIsFinanceModalOpen(true)}
          onRefresh={fetchAllData}
          loading={loading}
        />

        {/* Training and Finance Tracking */}
        <OpsCard
          opsData={opsData}
          onOpenModal={handleOpenAddSession}
          onEditSession={handleOpenEditSession}
          loading={loading}
        />

        {/* WhatsApp & Excel Command Center */}
        <CommsCard
          commsData={commsData}
          onRefresh={fetchAllData}
          loading={loading}
          onOpenExcelModal={() => setIsEnquiryModalOpen(true)}
        />

        {/* Dev Progress */}
        <div className="xl:col-span-2">
          <DevProgressCard
            devData={devData}
            onOpenModal={() => setIsDevModalOpen(true)}
            loading={loading}
          />
        </div>

        {/* Google Calendar Upcoming Events Widget */}
        <div className="xl:col-span-2">
          <CalendarWidget />
        </div>
      </div>

      {/* Modals & Setup Drawer */}
      <FinanceModal isOpen={isFinanceModalOpen} onClose={() => setIsFinanceModalOpen(false)} onRefresh={fetchAllData} />
      <OpsModal
        isOpen={isOpsModalOpen}
        onClose={() => {
          setIsOpsModalOpen(false);
          setEditingSession(null);
        }}
        onRefresh={fetchAllData}
        sessionToEdit={editingSession}
        masterParticipantsList={opsData?.masterParticipants}
      />
      <DevModal isOpen={isDevModalOpen} onClose={() => setIsDevModalOpen(false)} onRefresh={fetchAllData} />
      <EnquiryModal isOpen={isEnquiryModalOpen} onClose={() => setIsEnquiryModalOpen(false)} onRefreshParent={fetchAllData} />
      <SetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onRefresh={fetchAllData}
        initialTab={setupInitialTab}
      />
    </div>
  );
}
