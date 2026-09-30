import { useState, type FC } from 'react';
import { 
  PlayCircle, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  Flame, 
  Music, 
  Bot, 
  MessageSquareText, 
  Award,
  BookOpen
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
            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
              <Award className="h-6 w-6 text-[#e5c158]" />
              <div>
                <span className="text-[10px] text-white/50 block font-semibold uppercase tracking-wider">
                  Progression
                </span>
                <span className="text-sm font-bold text-white">
                  {progressPercent}% ({completedCount}/{modulesList.length} validés)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#d4af37] to-[#e5c158] transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Grid: Modules List & Module Player Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Modules list (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 px-1">
            Parcours de Formation (4 Modules)
          </h3>

          {modulesList.map((mod, index) => (
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

            {/* Module Details & Validation Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
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
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  {selectedModule.description}
                </p>
              </div>

              <button
                onClick={() => toggleModuleCompleted(selectedModule.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all shrink-0 ${
                  selectedModule.completed
                    ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'bg-white text-black hover:bg-neutral-200'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{selectedModule.completed ? 'Module validé' : 'Marquer comme validé'}</span>
              </button>
            </div>

            {/* Interactive Toolbox & Ready Prompts */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#07080c] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-neutral-300" />
                  Boîte à Outils & Prompts Prêts à l'Emploi
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">Copie directe</span>
              </div>

              <div className="space-y-2.5">
                {TOOLBOX_RESOURCES.map((res) => (
                  <div
                    key={res.id}
                    className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.03] transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase rounded bg-white/[0.06] px-1.5 py-0.5 text-[#e5c158]">
                          {res.category}
                        </span>
                        <span className="text-xs font-bold text-white">{res.title}</span>
                      </div>
                      <button
                        onClick={() => copyResource(res.id, res.content)}
                        className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:text-white hover:bg-white/[0.08] transition-all"
                      >
                        {copiedResourceId === res.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Copié !</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copier</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-[11px] text-white/60 bg-black/40 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap font-sans leading-relaxed">
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
