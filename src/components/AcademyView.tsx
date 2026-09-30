import { useState, type FC } from 'react';
import { 
  PlayCircle, 
  CheckCircle2, 
  Clock, 
  Download, 
  FileText, 
  Flame, 
  Music, 
  Bot, 
  MessageSquareText, 
  Award
} from 'lucide-react';
import type { AcademyModule } from '../types';

interface AcademyViewProps {
  modules: AcademyModule[];
}

export const AcademyView: FC<AcademyViewProps> = ({ modules }) => {
  const [selectedModuleId, setSelectedModuleId] = useState(modules[0]?.id || '');
  const selectedModule = modules.find((m) => m.id === selectedModuleId) || modules[0];

  const getModuleIcon = (iconName: string) => {
    switch (iconName) {
      case 'Music2':
        return <Music className="h-5 w-5 text-[#e5c158]" />;
      case 'Flame':
        return <Flame className="h-5 w-5 text-amber-400" />;
      case 'MessageSquareText':
        return <MessageSquareText className="h-5 w-5 text-blue-400" />;
      case 'Bot':
        return <Bot className="h-5 w-5 text-purple-400" />;
      default:
        return <PlayCircle className="h-5 w-5 text-[#e5c158]" />;
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#12141c] via-[#0d0e14] to-[#08090d] p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-[#d4af37]/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-2 w-2 rounded-full bg-[#d4af37]" />
              <p className="text-xs font-semibold uppercase tracking-wider text-[#e5c158]">
                L'Académie Velaris Studio
              </p>
            </div>
            <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Formation Clé en Main : Lance ton Studio
            </h1>
            <p className="text-sm text-white/60 mt-1 max-w-xl">
              De zéro à tes premières ventes quotidiennes de chansons personnalisées avec Facebook Ads et l'IA.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-2.5">
              <Award className="h-5 w-5 text-[#e5c158]" />
              <div>
                <span className="text-[10px] text-white/50 block">Progression</span>
                <span className="text-xs font-bold text-white">50% Complété</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Modules List & Module Player Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Modules list (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 px-1">
            Parcours de Formation (4 Modules)
          </h3>

          {modules.map((mod, index) => (
            <div
              key={mod.id}
              onClick={() => setSelectedModuleId(mod.id)}
              className={`rounded-2xl border p-4 transition-all cursor-pointer ${
                mod.id === selectedModule.id
                  ? 'border-[#d4af37] bg-white/[0.04] shadow-lg shadow-[#d4af37]/10'
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  {getModuleIcon(mod.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#e5c158]">
                      Module {index + 1} • {mod.level}
                    </span>
                    {mod.completed && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Validé
                      </span>
                    )}
                  </div>
                  <h4 className="font-['Space_Grotesk'] text-sm font-bold text-white mt-0.5 line-clamp-1">
                    {mod.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] text-white/40 mt-1.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {mod.duration}
                    </span>
                    <span>•</span>
                    <span>{mod.lessonsCount} leçons</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Selected Module Content & Video Player Area (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6 backdrop-blur-md space-y-5">
            {/* Video Player Mockup */}
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/[0.08] bg-[#07080c] flex items-center justify-center group shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
              <div className="relative z-20 flex flex-col items-center gap-3">
                <button className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-[#d4af37] to-[#e5c158] text-black shadow-[0_0_30px_rgba(212,175,55,0.4)] group-hover:scale-110 transition-transform">
                  <PlayCircle className="h-8 w-8 ml-0.5 fill-current" />
                </button>
                <span className="text-xs font-semibold text-white/90">
                  Lancer la session vidéo ({selectedModule.duration})
                </span>
              </div>
            </div>

            {/* Module Details & Summary */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-md bg-[#d4af37]/20 px-2 py-0.5 text-[10px] font-bold text-[#e5c158]">
                  {selectedModule.level}
                </span>
                <span className="text-xs text-white/50">{selectedModule.duration}</span>
              </div>
              <h2 className="font-['Space_Grotesk'] text-xl font-bold text-white">
                {selectedModule.title}
              </h2>
              <p className="text-xs text-white/70 mt-2 leading-relaxed">
                {selectedModule.description}
              </p>
            </div>

            {/* Downloadable Resources Box */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#07080c] p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white/50 block">
                Ressources & Outils à Télécharger
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-4 w-4 text-[#e5c158] shrink-0" />
                    <span className="text-xs text-white/80 truncate">Prompts_Suno_Afrique.pdf</span>
                  </div>
                  <Download className="h-3.5 w-3.5 text-white/50 hover:text-white shrink-0 cursor-pointer" />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-xs text-white/80 truncate">Scripts_WhatsApp_Closing.docx</span>
                  </div>
                  <Download className="h-3.5 w-3.5 text-white/50 hover:text-white shrink-0 cursor-pointer" />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="text-xs text-white/80 truncate">Templates_Canva_Ads.zip</span>
                  </div>
                  <Download className="h-3.5 w-3.5 text-white/50 hover:text-white shrink-0 cursor-pointer" />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-4 w-4 text-purple-400 shrink-0" />
                    <span className="text-xs text-white/80 truncate">Grille_Tarifs_Recommandes.xlsx</span>
                  </div>
                  <Download className="h-3.5 w-3.5 text-white/50 hover:text-white shrink-0 cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
