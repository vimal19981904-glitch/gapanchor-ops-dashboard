'use client';

import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Users, Award, BookOpen, UserCheck, Calendar, Sparkles, BarChart2 } from 'lucide-react';

interface TrainersDonutChartProps {
  trainers: any[];
  summary: any;
}

export default function TrainersDonutChart({ trainers = [], summary }: TrainersDonutChartProps) {
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('all');
  const [chartMode, setChartMode] = useState<'workload' | 'courses'>('workload');

  const selectedTrainer = trainers.find((t) => t.id === selectedTrainerId);

  // Vibrant Gradient Palette Fills
  const roleData = summary?.roleDistribution || [
    { name: 'Batch Trainers', value: 4, color: '#818cf8', gradient: 'url(#indigoGradient)' },
    { name: 'Job Support Staff', value: 3, color: '#22d3ee', gradient: 'url(#cyanGradient)' },
    { name: 'Dual Role (Both)', value: 2, color: '#34d399', gradient: 'url(#emeraldGradient)' },
  ];

  const courseData = summary?.courseDistribution || [
    { name: 'Manhattan WMS', value: 3, color: '#38bdf8', gradient: 'url(#skyGradient)' },
    { name: 'Blue Yonder', value: 2, color: '#818cf8', gradient: 'url(#indigoGradient)' },
    { name: 'Kinaxis', value: 1, color: '#34d399', gradient: 'url(#emeraldGradient)' },
    { name: 'SAP S/4HANA', value: 1, color: '#fbbf24', gradient: 'url(#amberGradient)' },
  ];

  // Specific Trainer Donut Data (if a trainer is selected)
  const trainerSpecificData = selectedTrainer
    ? [
        { name: 'Batches Taken', value: selectedTrainer.totalBatches || 0, color: '#818cf8', gradient: 'url(#indigoGradient)' },
        { name: 'Job Support Leads', value: selectedTrainer.jobSupportLeads || 0, color: '#22d3ee', gradient: 'url(#cyanGradient)' },
        { name: 'Years Experience', value: Math.round(selectedTrainer.experienceYears || 3), color: '#fbbf24', gradient: 'url(#amberGradient)' },
      ]
    : null;

  const activeChartData = selectedTrainer
    ? trainerSpecificData
    : chartMode === 'workload'
    ? roleData
    : courseData;

  const totalCount = selectedTrainer
    ? (selectedTrainer.totalBatches || 0) + (selectedTrainer.jobSupportLeads || 0)
    : summary?.totalTrainers || trainers.length || 6;

  return (
    <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-950/80 to-slate-900/90 border border-indigo-500/20 backdrop-blur-xl shadow-2xl space-y-4">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 text-indigo-400 shrink-0">
            <Sparkles size={16} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider bg-gradient-to-r from-indigo-300 via-cyan-200 to-white bg-clip-text text-transparent flex items-center gap-2">
              Trainer Status & Operational Distribution
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {selectedTrainer
                ? `Individual operational metrics for ${selectedTrainer.name}`
                : 'Workload & course specialization analytics across all registered staff'}
            </p>
          </div>
        </div>

        {/* Controls: Selector & Mode Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto justify-end">
          {/* Trainer Switcher */}
          <select
            value={selectedTrainerId}
            onChange={(e) => setSelectedTrainerId(e.target.value)}
            className="rounded-xl border border-indigo-500/40 px-3 py-1.5 text-xs font-bold bg-slate-950 text-indigo-200 outline-none focus:border-indigo-400 cursor-pointer shadow-md"
          >
            <option value="all">All Trainers & Operational Staff</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.role})
              </option>
            ))}
          </select>

          {!selectedTrainer && (
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-bold">
              <button
                onClick={() => setChartMode('workload')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMode === 'workload'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Workload
              </button>
              <button
                onClick={() => setChartMode('courses')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMode === 'courses'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Courses
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Donut Chart + Info Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Donut Visual with Neon Radial Glow */}
        <div className="md:col-span-5 relative flex justify-center items-center h-52">
          {/* Background Neon Halo Glow */}
          <div className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-indigo-500/20 via-cyan-500/20 to-emerald-500/20 blur-xl pointer-events-none" />

          <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
            <PieChart style={{ outline: 'none' }}>
              <defs>
                <linearGradient id="indigoGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
                <linearGradient id="cyanGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#0891b2" />
                </linearGradient>
                <linearGradient id="emeraldGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="skyGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
                <linearGradient id="amberGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>

              <Pie
                data={activeChartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {activeChartData.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.gradient || entry.color}
                    style={{ outline: 'none' }}
                    className="hover:opacity-90 transition-opacity cursor-pointer outline-none focus:outline-none focus:ring-0"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#090d16',
                  borderColor: '#374151',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#fff',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center Stat Badge */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black text-white tracking-tight drop-shadow-md">{totalCount}</span>
            <span className="text-[10px] uppercase font-extrabold text-indigo-300 tracking-wider">
              {selectedTrainer ? 'Total Ops' : selectedTrainerId === 'all' ? 'Registered' : 'Count'}
            </span>
          </div>
        </div>

        {/* Metrics Breakdown List */}
        <div className="md:col-span-7 space-y-3">
          {selectedTrainer ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col justify-between space-y-2 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen size={14} className="text-indigo-400" /> Batches
                  </span>
                  <span className="text-lg font-black text-indigo-300 font-mono tracking-tight">
                    {selectedTrainer.totalBatches || 0}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Total batches led</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex flex-col justify-between space-y-2 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck size={14} className="text-cyan-400" /> Job Support
                  </span>
                  <span className="text-lg font-black text-cyan-300 font-mono tracking-tight">
                    {selectedTrainer.jobSupportLeads || 0}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Active client leads</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex flex-col justify-between space-y-2 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} className="text-amber-400" /> Experience
                  </span>
                  <span className="text-base font-black text-amber-300 font-mono tracking-tight">
                    {selectedTrainer.experienceYears || 3} Yrs
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Industry domain exp</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {activeChartData.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/30 flex items-center justify-between transition-all shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-bold text-slate-200 truncate">{item.name}</span>
                  </div>
                  <span className="text-sm font-black text-white font-mono shrink-0">
                    {item.value} Staff
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

