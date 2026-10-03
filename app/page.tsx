'use client';

import React, { useState, useEffect } from 'react';
import DashboardHeader from '@/components/DashboardHeader';
import StatCard from '@/components/StatCard';
import FinanceCard from '@/components/FinanceCard';
import FinanceModal from '@/components/FinanceModal';
import OpsCard from '@/components/OpsCard';
import OpsModal from '@/components/OpsModal';
import CommsCard from '@/components/CommsCard';
import JobSupportCard from '@/components/JobSupportCard';
import JobSupportModal from '@/components/JobSupportModal';
import DevProgressCard from '@/components/DevProgressCard';
import DevModal from '@/components/DevModal';
import SetupModal from '@/components/SetupModal';
import EnquiryModal from '@/components/EnquiryModal';
import CalendarWidget from '@/components/CalendarWidget';
import TrainersCard from '@/components/TrainersCard';
import { SkeletonKPI } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, Calendar, MessageSquare, Code2 } from 'lucide-react';

import NavigationDrawer from '@/components/NavigationDrawer';

export default function Dashboard() {
  const [financeData, setFinanceData] = useState<any>(null);
  const [opsData, setOpsData] = useState<any>(null);
  const [commsData, setCommsData] = useState<any>(null);
  const [devData, setDevData] = useState<any>(null);
  const [jobSupportData, setJobSupportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Navigation Drawer
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);

  // Modals
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);
  const [isOpsModalOpen, setIsOpsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [isJobSupportModalOpen, setIsJobSupportModalOpen] = useState(false);
  const [editingJobSupportSession, setEditingJobSupportSession] = useState<any | null>(null);
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

  const handleOpenAddJobSupportSession = () => {
    setEditingJobSupportSession(null);
    setIsJobSupportModalOpen(true);
  };

  const handleOpenEditJobSupportSession = (session: any) => {
    setEditingJobSupportSession(session);
    setIsJobSupportModalOpen(true);
  };

  const fetchAllData = async () => {
    try {
      const [finRes, opsRes, commsRes, devRes, jsRes] = await Promise.all([
        fetch('/api/finance'),
        fetch('/api/ops'),
        fetch('/api/comms'),
        fetch('/api/dev'),
        fetch('/api/job-support/session'),
      ]);

      const [finJson, opsJson, commsJson, devJson, jsJson] = await Promise.all([
        finRes.json(), opsRes.json(), commsRes.json(), devRes.json(), jsRes.json(),
      ]);

      if (finJson.success) setFinanceData(finJson);
      if (opsJson.success) setOpsData(opsJson);
      if (commsJson.success) setCommsData(commsJson);
      if (devJson.success) setDevData(devJson);
      if (jsJson.success) setJobSupportData(jsJson);
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
    <div className="w-full max-w-full overflow-x-hidden px-2 sm:px-6 md:px-8 py-2 sm:py-6">
      <DashboardHeader
        onRefresh={handleRefresh}
        isRefreshing={refreshing}
        graphStatus={financeData?.graphApiStatus}
        whatsappStatus={commsData?.whatsappConfig}
        onOpenSetup={handleOpenSetup}
        onOpenNav={() => setIsNavDrawerOpen(true)}
      />

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-5 mb-3 sm:mb-7">
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
              color="emerald"
            />
            <StatCard
              title="Training Ops"
              value={`${totalSessions} Sessions`}
              subtext={`${totalParticipants} Participants Across SCM`}
              icon={Calendar}
              color="indigo"
            />
            <StatCard
              title="Leads"
              value={`${enquiryTotal} Total`}
              subtext={actionCount > 0 ? `${actionCount} pending action` : 'All processed'}
              icon={MessageSquare}
              color={actionCount > 0 ? 'amber' : 'cyan'}
            />
            <StatCard
              title="Dev Progress"
              value={`${devCount} Shipped`}
              subtext="Features, Fixes & Infra"
              icon={Code2}
              color="amber"
            />
          </>
        )}
      </div>

      {/* Main Module Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 sm:gap-6">
        {/* Finance Module (Full Width) */}
        <div id="finance-section" className="xl:col-span-2 transition-all rounded-3xl">
          <FinanceCard
            financeData={financeData}
            onOpenModal={() => setIsFinanceModalOpen(true)}
            onRefresh={fetchAllData}
            loading={loading}
          />
        </div>

        {/* Training Operations */}
        <div id="ops-section" className="transition-all rounded-3xl h-full flex flex-col">
          <OpsCard
            opsData={opsData}
            onOpenModal={handleOpenAddSession}
            onEditSession={handleOpenEditSession}
            loading={loading}
          />
        </div>

        {/* Job Support Operations (Fills the dashboard empty space!) */}
        <div id="job-support-section" className="transition-all rounded-3xl h-full flex flex-col">
          <JobSupportCard
            jobSupportData={jobSupportData}
            onOpenModal={handleOpenAddJobSupportSession}
            onEditSession={handleOpenEditJobSupportSession}
            onRefresh={fetchAllData}
            loading={loading}
          />
        </div>

        {/* WhatsApp & Excel Command Center */}
        <div id="comms-section" className="xl:col-span-2 transition-all rounded-3xl">
          <CommsCard
            commsData={commsData}
            onRefresh={fetchAllData}
            loading={loading}
            onOpenExcelModal={() => setIsEnquiryModalOpen(true)}
          />
        </div>

        {/* Dev Progress */}
        <div id="dev-section" className="xl:col-span-2 transition-all rounded-3xl">
          <DevProgressCard
            devData={devData}
            onOpenModal={() => setIsDevModalOpen(true)}
            loading={loading}
          />
        </div>

        {/* Google Calendar Upcoming Events Widget */}
        <div id="calendar-section" className="xl:col-span-2 transition-all rounded-3xl">
          <CalendarWidget />
        </div>

        {/* Trainers & Operations Work With Us Intake Section */}
        <div id="trainers-section" className="xl:col-span-2 transition-all rounded-3xl">
          <TrainersCard onRefreshParent={fetchAllData} />
        </div>
      </div>

      {/* Navigation Drawer */}
      <NavigationDrawer
        isOpen={isNavDrawerOpen}
        onClose={() => setIsNavDrawerOpen(false)}
        onOpenFinanceModal={() => setIsFinanceModalOpen(true)}
        onOpenOpsModal={() => setIsOpsModalOpen(true)}
        onOpenEnquiryModal={() => setIsEnquiryModalOpen(true)}
        onOpenDevModal={() => setIsDevModalOpen(true)}
        onOpenSetupModal={handleOpenSetup}
        financeSummary={financeData?.summary}
        opsSummary={opsData?.summary}
        commsSummary={commsData?.summary}
        devSummary={devData}
      />

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
      <JobSupportModal
        isOpen={isJobSupportModalOpen}
        onClose={() => {
          setIsJobSupportModalOpen(false);
          setEditingJobSupportSession(null);
        }}
        onRefresh={fetchAllData}
        sessionToEdit={editingJobSupportSession}
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
