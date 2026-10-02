import { useState, type FC } from 'react';
import { 
  PlayCircle, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  Music, 
  Bot, 
  MessageSquareText, 
  Award,
  BookOpen,
  TrendingUp
} from 'lucide-react';
import type { AcademyModule } from '../types';

interface AcademyViewProps {
  modules: AcademyModule[];
}

interface ResourceItem {
  id: string;
  title: string;
  category: string;
  content: string;
}

const TOOLBOX_RESOURCES: ResourceItem[] = [
  {
    id: 'suno_prompt',
    title: 'Prompt Maître Suno IA (Afro-Love & Acoustique)',
    category: 'Studio IA',
    content: `[Style & Tags]: Afro-love, acoustic guitar, warm soulful vocal, slow tempo 85 bpm, emotional, gentle West African percussion, romantic ballad

[Structure Recommandée]:
[Intro - Guitare acoustique douce]
[Verse 1 - Récit de la rencontre et des débuts]
[Chorus - Refrain mélodique accrocheur avec chœurs]
[Verse 2 - Témoignage d'amour et de gratitude]
[Bridge - Montée en émotion intime]
[Chorus - Climax vocal]
[Outro - Dédicace et fondu guitare]`,
  },
  {
    id: 'whatsapp_welcome',
    title: 'Protocole d\'Accueil WhatsApp (Trafic Publicitaire)',
    category: 'Vente WhatsApp',
    content: `« Bonjour et bienvenue au Studio Velaris.
Nous concevons des compositions musicales sur-mesure pour célébrer les moments marquants : anniversaires, fiançailles, hommages et mariages.

Pour démarrer la création des paroles, précisez-nous le prénom du destinataire ainsi que l'occasion célébrée. »`,
  },
  {
    id: 'whatsapp_pricing',
    title: 'Protocole Tarifaire & Validation des Paroles',
    category: 'Closing Vente',
    content: `« Nous avons bien noté vos éléments. Notre protocole de production se déroule en 3 étapes :

1. Rédaction intégrale du texte et envoi pour validation sur ce fil WhatsApp.
2. Choix de la formule de mastering :
   • 1 200 FCFA : Master Audio HD (Format MP3 Studio 24-bit)
   • 3 000 FCFA : Pack Intégral (Master Audio HD + Vidéo Paroles Synchronisées)
3. Rendu studio et expédition de votre fichier en moins de 18 minutes.

Validez-vous le lancement de l'écriture des paroles ? »`,
  },
  {
    id: 'facebook_ad_copy',
    title: 'Texte Publicitaire Facebook & TikTok Ads',
    category: 'Acquisition Ads',
    content: `« Le souvenir le plus marquant que vous puissiez offrir.
Une chanson originale entièrement composée à partir de vos souvenirs, anecdotes et prénoms.
Livraison du master audio en moins de 30 minutes sur WhatsApp.
Écoutez les extraits studio et réservez votre composition dès aujourd'hui. »`,
  },
];

export const AcademyView: FC<AcademyViewProps> = ({ modules: initialModules }) => {
  const [modulesList, setModulesList] = useState(initialModules);
  const [selectedModuleId, setSelectedModuleId] = useState(initialModules[0]?.id || '');
  const [copiedResourceId, setCopiedResourceId] = useState<string | null>(null);

  const selectedModule = modulesList.find((m) => m.id === selectedModuleId) || modulesList[0];

  const completedCount = modulesList.filter((m) => m.completed).length;
  const progressPercent = Math.round((completedCount / modulesList.length) * 100);

  const toggleModuleCompleted = (id: string) => {
    setModulesList((prev) =>
      prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m))
    );
  };

  const copyResource = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedResourceId(id);
    setTimeout(() => setCopiedResourceId(null), 2000);
  };

  const getModuleIcon = (iconName: string) => {
    switch (iconName) {
      case 'Music2':
        return <Music className="h-4 w-4 text-white" />;
      case 'Flame':
        return <TrendingUp className="h-4 w-4 text-white" />;
      case 'MessageSquareText':
        return <MessageSquareText className="h-4 w-4 text-white" />;
      case 'Bot':
        return <Bot className="h-4 w-4 text-white" />;
      default:
        return <PlayCircle className="h-4 w-4 text-white" />;
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Executive Curriculum Header */}
      <div className="rounded-2xl border border-[#2D261E] bg-[#0E0C0A] p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11.5px] font-mono tracking-wider text-neutral-300 uppercase">
                ACADÉMIE DU STUDIO
              </span>
              <span className="text-[13px] font-mono text-neutral-500">Cursus Clé en Main</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight mt-1">
              Formation & Maîtrise du Studio WhatsApp
            </h1>
            <p className="text-[13px] text-[#A8A29E] mt-1 max-w-xl">
              De zéro à vos premières ventes quotidiennes de chansons personnalisées avec Facebook Ads et Suno IA.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-[#2D261E] px-4 py-2.5">
              <Award className="h-5 w-5 text-white" />
              <div>
                <span className="text-[11.5px] font-mono uppercase tracking-wider text-[#A8A29E] block">
                  Progression
                </span>
                <span className="text-[13px] font-mono font-bold text-white">
                  {progressPercent}% ({completedCount}/{modulesList.length} validés)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div 
            className="h-full bg-white transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Grid: Modules List & Module Player Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Modules list (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="text-[11.5px] font-mono uppercase tracking-widest text-[#A8A29E] px-1">
            PARCOURS PÉDAGOGIQUE (4 MODULES)
          </div>

          {modulesList.map((mod, index) => (
            <div
              key={mod.id}
              onClick={() => setSelectedModuleId(mod.id)}
              className={`rounded-xl border p-4 transition-all cursor-pointer ${
                mod.id === selectedModule.id
                  ? 'border-white/30 bg-[#1A1713] shadow-sm'
                  : 'border-[#2D261E] bg-[#0E0C0A] hover:bg-[#1A1713] hover:border-white/15'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-[#2D261E]">
                  {getModuleIcon(mod.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-mono uppercase tracking-wider text-[#A8A29E]">
                      Module 0{index + 1} • {mod.level}
                    </span>
                    {mod.completed && (
                      <span className="flex items-center gap-1 text-[11.5px] font-mono text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Validé
                      </span>
                    )}
                  </div>
                  <h4 className="text-[13px] font-bold text-white mt-0.5 line-clamp-1">
                    {mod.title}
                  </h4>
                  <div className="flex items-center gap-2 text-[11.5px] font-mono text-[#A8A29E] mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {mod.duration}
                    </span>
                    <span>•</span>
                    <span>{mod.lessonsCount} chapitres</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Selected Module Content & Video Player Area (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-2xl border border-[#2D261E] bg-[#0E0C0A] p-5 sm:p-6 space-y-5">
            {/* Video Player Frame */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-[#2D261E] bg-[#1A1713] flex items-center justify-center group shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
              <div className="relative z-20 flex flex-col items-center gap-3">
                <button className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-[0_0_25px_rgba(255,255,255,0.2)] group-hover:scale-105 transition-transform cursor-pointer">
                  <PlayCircle className="h-7 w-7 ml-0.5 fill-current" />
                </button>
                <span className="text-[13px] font-mono text-neutral-300">
                  Lancer le cours ({selectedModule.duration})
                </span>
              </div>
            </div>

            {/* Module Details & Validation Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#2D261E]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.2 text-[10.5px] font-mono uppercase text-neutral-300">
                    {selectedModule.level}
                  </span>
                  <span className="text-[13px] font-mono text-neutral-500">{selectedModule.duration}</span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {selectedModule.title}
                </h2>
                <p className="text-[13px] text-[#A8A29E] mt-1 leading-relaxed">
                  {selectedModule.description}
                </p>
              </div>

              <button
                onClick={() => toggleModuleCompleted(selectedModule.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-all shrink-0 cursor-pointer ${
                  selectedModule.completed
                    ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'bg-white text-black hover:bg-neutral-200'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{selectedModule.completed ? 'Module validé' : 'Marquer comme validé'}</span>
              </button>
            </div>

            {/* Interactive Toolbox & Ready Prompts */}
            <div className="rounded-xl border border-[#2D261E] bg-[#1A1713] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-mono uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-[#A8A29E]" />
                  Boîte à Outils & Prompts Prêts à l'Emploi
                </span>
                <span className="text-[11.5px] text-neutral-500 font-mono">1-Clic Copie</span>
              </div>

              <div className="space-y-2.5">
                {TOOLBOX_RESOURCES.map((res) => (
                  <div
                    key={res.id}
                    className="p-3.5 rounded-lg border border-[#2D261E]/60 bg-[#0E0C0A] hover:border-[#3A3022] transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10.5px] font-mono uppercase tracking-wider rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-neutral-300">
                          {res.category}
                        </span>
                        <span className="text-[13px] font-semibold text-white">{res.title}</span>
                      </div>
                      <button
                        onClick={() => copyResource(res.id, res.content)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#2D261E] bg-white/[0.03] px-2 py-0.5 text-[11.5px] font-mono text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
                      >
                        {copiedResourceId === res.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copier</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-[12.5px] text-[#A8A29E] bg-black/40 p-2.5 rounded-md overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed border border-[#2D261E]/60">
                      {res.content}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
