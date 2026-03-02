import type { TranslationEngine } from './interface.js';

/**
 * LocalHeuristicTranslator: dictionary-based offline translation.
 * Ships word-level dictionaries for Esperanto, Japanese, Spanish, French, and German.
 * Esperanto has perfectly regular grammar — ideal for rule-based translation.
 * For unsupported language pairs, falls back to a tagged pass-through.
 */
export class LocalHeuristicTranslator implements TranslationEngine {
  readonly name = 'heuristic';

  async translate(opts: { text: string; srcLang?: string; targetLang: string; context?: string[] }): Promise<string> {
    const src = opts.srcLang || 'auto';
    const tgt = opts.targetLang;

    if (src === tgt) return opts.text;

    // Try dictionary-based translation
    const dict = getDictionary(src, tgt);
    if (dict) {
      return translateWithDict(opts.text, dict);
    }

    // Fallback: tagged pass-through
    return `[${src.toUpperCase()}→${tgt.toUpperCase()}] ${opts.text}`;
  }
}

// ── Dictionary lookup ─────────────────────────────────────

interface LangDict {
  words: Map<string, string>;
}

function getDictionary(src: string, tgt: string): LangDict | null {
  const key = `${src}→${tgt}`;
  if (DICTIONARIES.has(key)) return DICTIONARIES.get(key)!;

  // Build reverse dictionary on demand
  const reverseKey = `${tgt}→${src}`;
  if (DICTIONARIES.has(reverseKey)) {
    const fwd = DICTIONARIES.get(reverseKey)!;
    const rev = new Map<string, string>();
    for (const [k, v] of fwd.words) {
      // Only add the first mapping (avoid collisions)
      if (!rev.has(v.toLowerCase())) {
        rev.set(v.toLowerCase(), k);
      }
    }
    const revDict: LangDict = { words: rev };
    DICTIONARIES.set(key, revDict);
    return revDict;
  }

  return null;
}

function translateWithDict(text: string, dict: LangDict): string {
  // Tokenize preserving punctuation and spacing
  const tokens = text.match(/[\w'']+|[^\w\s]+|\s+/g) || [text];

  const translated = tokens.map(token => {
    // Skip whitespace and punctuation
    if (/^\s+$/.test(token) || /^[^\w]+$/.test(token)) return token;

    const lower = token.toLowerCase();

    // Try multi-word phrases (2-word lookahead handled below)
    const mapped = dict.words.get(lower);
    if (mapped) {
      // Preserve original capitalization
      if (token[0] === token[0].toUpperCase() && token[0] !== token[0].toLowerCase()) {
        return mapped.charAt(0).toUpperCase() + mapped.slice(1);
      }
      return mapped;
    }

    // Keep unknown words as-is (proper nouns, tech terms)
    return token;
  });

  return translated.join('');
}

// ── Dictionaries ──────────────────────────────────────────

const DICTIONARIES = new Map<string, LangDict>();

// ── English → Esperanto ──────────────────────────────────
// Esperanto grammar: nouns -o, adjectives -a, adverbs -e, verbs -as (present),
// -is (past), -os (future), plural -j, accusative -n
const EN_EO = new Map<string, string>([
  // Pronouns
  ['i', 'mi'], ['me', 'min'], ['my', 'mia'], ['mine', 'mia'],
  ['you', 'vi'], ['your', 'via'], ['yours', 'via'],
  ['he', 'li'], ['him', 'lin'], ['his', 'lia'],
  ['she', 'ŝi'], ['her', 'ŝin'], ['hers', 'ŝia'],
  ['it', 'ĝi'], ['its', 'ĝia'],
  ['we', 'ni'], ['us', 'nin'], ['our', 'nia'],
  ['they', 'ili'], ['them', 'ilin'], ['their', 'ilia'],
  ['this', 'ĉi tio'], ['that', 'tio'], ['these', 'ĉi tiuj'], ['those', 'tiuj'],
  ['who', 'kiu'], ['what', 'kio'], ['which', 'kiu'], ['where', 'kie'],
  ['when', 'kiam'], ['why', 'kial'], ['how', 'kiel'],

  // Articles & particles
  ['the', 'la'], ['a', 'unu'], ['an', 'unu'],
  ['and', 'kaj'], ['or', 'aŭ'], ['but', 'sed'], ['not', 'ne'],
  ['no', 'ne'], ['yes', 'jes'], ['if', 'se'], ['then', 'tiam'],
  ['so', 'do'], ['also', 'ankaŭ'], ['too', 'ankaŭ'], ['very', 'tre'],
  ['just', 'ĵus'], ['now', 'nun'], ['here', 'ĉi tie'], ['there', 'tie'],
  ['still', 'ankoraŭ'], ['already', 'jam'], ['again', 'denove'],
  ['always', 'ĉiam'], ['never', 'neniam'], ['sometimes', 'iam'],
  ['perhaps', 'eble'], ['maybe', 'eble'], ['really', 'vere'],
  ['only', 'nur'], ['even', 'eĉ'], ['well', 'bone'],

  // Prepositions
  ['to', 'al'], ['from', 'de'], ['in', 'en'], ['on', 'sur'],
  ['at', 'ĉe'], ['with', 'kun'], ['without', 'sen'],
  ['for', 'por'], ['of', 'de'], ['about', 'pri'],
  ['between', 'inter'], ['into', 'en'], ['out', 'el'],
  ['up', 'supren'], ['down', 'malsupren'], ['after', 'post'],
  ['before', 'antaŭ'], ['during', 'dum'], ['through', 'tra'],
  ['under', 'sub'], ['over', 'super'], ['across', 'trans'],

  // Common verbs (present tense -as)
  ['is', 'estas'], ['are', 'estas'], ['was', 'estis'], ['were', 'estis'],
  ['be', 'esti'], ['been', 'estinta'], ['being', 'estante'],
  ['has', 'havas'], ['have', 'havas'], ['had', 'havis'],
  ['do', 'faras'], ['does', 'faras'], ['did', 'faris'],
  ['will', 'faros'], ['would', 'farus'], ['could', 'povus'],
  ['should', 'devus'], ['can', 'povas'], ['must', 'devas'],
  ['need', 'bezonas'], ['needs', 'bezonas'], ['needed', 'bezonis'],
  ['want', 'volas'], ['wants', 'volas'], ['wanted', 'volis'],
  ['know', 'scias'], ['knows', 'scias'], ['knew', 'sciis'],
  ['think', 'pensas'], ['thinks', 'pensas'], ['thought', 'pensis'],
  ['say', 'diras'], ['says', 'diras'], ['said', 'diris'],
  ['tell', 'diras'], ['told', 'diris'],
  ['see', 'vidas'], ['sees', 'vidas'], ['saw', 'vidis'],
  ['come', 'venas'], ['comes', 'venas'], ['came', 'venis'],
  ['go', 'iras'], ['goes', 'iras'], ['went', 'iris'], ['gone', 'irinta'],
  ['get', 'ricevas'], ['gets', 'ricevas'], ['got', 'ricevs'],
  ['give', 'donas'], ['gives', 'donas'], ['gave', 'donis'],
  ['take', 'prenas'], ['takes', 'prenas'], ['took', 'prenis'],
  ['make', 'faras'], ['makes', 'faras'], ['made', 'faris'],
  ['find', 'trovas'], ['finds', 'trovas'], ['found', 'trovis'],
  ['use', 'uzas'], ['uses', 'uzas'], ['used', 'uzis'],
  ['work', 'laboras'], ['works', 'laboras'], ['worked', 'laboris'],
  ['call', 'vokas'], ['calls', 'vokas'], ['called', 'vokis'],
  ['try', 'provas'], ['tries', 'provas'], ['tried', 'provis'],
  ['ask', 'demandas'], ['asks', 'demandas'], ['asked', 'demandis'],
  ['put', 'metas'], ['puts', 'metas'],
  ['run', 'kuras'], ['runs', 'kuras'], ['ran', 'kuris'],
  ['move', 'movas'], ['moves', 'movas'], ['moved', 'movis'],
  ['live', 'vivas'], ['lives', 'vivas'], ['lived', 'vivis'],
  ['believe', 'kredas'], ['help', 'helpas'], ['start', 'komencas'],
  ['show', 'montras'], ['hear', 'aŭdas'], ['play', 'ludas'],
  ['turn', 'turnas'], ['leave', 'foriras'], ['keep', 'gardas'],
  ['let', 'lasu'], ['begin', 'komencu'], ['seem', 'ŝajnas'],
  ['talk', 'parolas'], ['speak', 'parolas'], ['read', 'legas'],
  ['write', 'skribas'], ['learn', 'lernas'], ['change', 'ŝanĝas'],
  ['follow', 'sekvas'], ['stop', 'haltas'], ['create', 'kreas'],
  ['open', 'malfermas'], ['close', 'fermas'], ['pay', 'pagas'],
  ['wait', 'atendas'], ['become', 'iĝas'], ['became', 'iĝis'],
  ['build', 'konstruas'], ['send', 'sendas'], ['choose', 'elektas'],
  ['grow', 'kreskas'], ['watch', 'rigardas'], ['remember', 'memoras'],
  ['love', 'amas'], ['consider', 'konsideras'], ['appear', 'aperas'],
  ['buy', 'aĉetas'], ['serve', 'servas'], ['bring', 'portas'],
  ['happen', 'okazas'], ['set', 'starigas'], ['sit', 'sidas'],
  ['stand', 'staras'], ['lose', 'perdas'], ['connect', 'konektas'],
  ['connects', 'konektas'], ['connected', 'konektis'],
  ['feed', 'provizas'], ['feeds', 'provizas'],
  ['deploy', 'deplojas'], ['integrate', 'integras'],
  ['improve', 'plibonigas'], ['scale', 'skalas'],
  ['process', 'procezas'], ['transform', 'transformas'],
  ['translate', 'tradukas'], ['broadcast', 'dissendas'],
  ['extract', 'eltiras'], ['update', 'ĝisdatigas'],
  ['configure', 'agordas'], ['expose', 'elmontras'],
  ['married', 'edziĝis'], ['promoted', 'promociita'],

  // Nouns
  ['time', 'tempo'], ['year', 'jaro'], ['people', 'homoj'],
  ['way', 'vojo'], ['day', 'tago'], ['man', 'viro'],
  ['woman', 'virino'], ['child', 'infano'], ['children', 'infanoj'],
  ['kid', 'infano'], ['kids', 'infanoj'],
  ['world', 'mondo'], ['life', 'vivo'], ['hand', 'mano'],
  ['part', 'parto'], ['place', 'loko'], ['case', 'kazo'],
  ['week', 'semajno'], ['company', 'kompanio'], ['system', 'sistemo'],
  ['program', 'programo'], ['question', 'demando'], ['work', 'laboro'],
  ['number', 'nombro'], ['night', 'nokto'], ['point', 'punkto'],
  ['home', 'hejmo'], ['water', 'akvo'], ['room', 'ĉambro'],
  ['mother', 'patrino'], ['area', 'areo'], ['money', 'mono'],
  ['story', 'historio'], ['fact', 'fakto'], ['month', 'monato'],
  ['lot', 'multe'], ['right', 'rajto'], ['study', 'studo'],
  ['book', 'libro'], ['eye', 'okulo'], ['job', 'laboro'],
  ['word', 'vorto'], ['side', 'flanko'], ['head', 'kapo'],
  ['house', 'domo'], ['service', 'servo'], ['friend', 'amiko'],
  ['father', 'patro'], ['power', 'potenco'], ['hour', 'horo'],
  ['game', 'ludo'], ['line', 'linio'], ['end', 'fino'],
  ['member', 'membro'], ['city', 'urbo'], ['community', 'komunumo'],
  ['name', 'nomo'], ['president', 'prezidanto'], ['team', 'teamo'],
  ['minute', 'minuto'], ['idea', 'ideo'], ['body', 'korpo'],
  ['information', 'informo'], ['back', 'dorso'], ['parent', 'gepatro'],
  ['face', 'vizaĝo'], ['thing', 'afero'], ['things', 'aferoj'],
  ['problem', 'problemo'], ['heart', 'koro'], ['history', 'historio'],

  // Tech terms
  ['server', 'servilo'], ['client', 'kliento'], ['database', 'datumbazo'],
  ['network', 'reto'], ['computer', 'komputilo'], ['software', 'programaro'],
  ['hardware', 'aparataro'], ['data', 'datumoj'], ['file', 'dosiero'],
  ['code', 'kodo'], ['message', 'mesaĝo'], ['user', 'uzanto'],
  ['language', 'lingvo'], ['translation', 'traduko'],
  ['speech', 'parolo'], ['audio', 'aŭdio'], ['platform', 'platformo'],
  ['pipeline', 'dukto'], ['microphone', 'mikrofono'],
  ['diagram', 'diagramo'], ['graph', 'grafo'], ['architecture', 'arkitekturo'],
  ['structure', 'strukturo'], ['intelligence', 'inteligenteco'],
  ['container', 'kontenero'], ['orchestration', 'orkestrado'],
  ['observability', 'observeblo'], ['persistence', 'persisteco'],
  ['gateway', 'enirejo'], ['transcription', 'transskribo'],
  ['encryption', 'ĉifrado'],

  // Adjectives
  ['good', 'bona'], ['new', 'nova'], ['first', 'unua'],
  ['last', 'lasta'], ['long', 'longa'], ['great', 'granda'],
  ['little', 'malgranda'], ['own', 'propra'], ['other', 'alia'],
  ['old', 'malnova'], ['right', 'ĝusta'], ['big', 'granda'],
  ['high', 'alta'], ['small', 'malgranda'], ['large', 'granda'],
  ['next', 'sekva'], ['early', 'frua'], ['young', 'juna'],
  ['important', 'grava'], ['few', 'malmulta'], ['bad', 'malbona'],
  ['same', 'sama'], ['able', 'kapabla'], ['different', 'malsama'],
  ['real', 'reala'], ['live', 'viva'], ['full', 'plena'],
  ['complete', 'kompleta'], ['every', 'ĉiu'], ['each', 'ĉiu'],

  // Numbers
  ['one', 'unu'], ['two', 'du'], ['three', 'tri'], ['four', 'kvar'],
  ['five', 'kvin'], ['six', 'ses'], ['seven', 'sep'], ['eight', 'ok'],
  ['nine', 'naŭ'], ['ten', 'dek'], ['hundred', 'cent'],

  // Misc
  ['okay', 'bone'], ['ok', 'bone'], ['once', 'iam'], ['upon', 'sur'],
  ['prince', 'princo'], ['princess', 'princino'], ['queen', 'reĝino'],
  ['king', 'reĝo'], ['then', 'tiam'], ['became', 'iĝis'],
  ['soup', 'supo'], ['carrot', 'karoto'], ['clam', 'konko'],
  ['chowder', 'supo'], ['conditional', 'kondiĉo'],

  // Demo-specific terms
  ['caching', 'kaŝmemorado'], ['tagging', 'etikedado'],
  ['offline', 'senlinie'], ['realtime', 'realtempe'],
  ['locally', 'loke'], ['entire', 'tuta'], ['demo', 'demonstraĵo'],
  ['fully', 'plene'],  ['privacy', 'privateco'],
]);
DICTIONARIES.set('en→eo', { words: EN_EO });

// ── English → Japanese (common phrases) ──────────────────
const EN_JA = new Map<string, string>([
  // Pronouns & particles
  ['i', '私は'], ['we', '私たちは'], ['you', 'あなたは'],
  ['he', '彼は'], ['she', '彼女は'], ['they', '彼らは'],
  ['this', 'これ'], ['that', 'それ'], ['it', 'それ'],
  ['the', ''], ['a', ''], ['an', ''],

  // Conjunctions
  ['and', 'そして'], ['or', 'または'], ['but', 'しかし'],
  ['so', 'だから'], ['if', 'もし'], ['then', 'そうすれば'],
  ['because', 'なぜなら'],

  // Common verbs
  ['is', 'です'], ['are', 'です'], ['was', 'でした'], ['were', 'でした'],
  ['uses', '使用する'], ['use', '使用する'], ['used', '使用した'],
  ['connects', '接続する'], ['connect', '接続する'],
  ['feeds', '供給する'], ['feed', '供給する'],
  ['calls', '呼び出す'], ['call', '呼び出す'],
  ['depends', '依存する'], ['need', '必要とする'], ['needs', '必要とする'],
  ['runs', '実行する'], ['run', '実行する'],
  ['builds', '構築する'], ['build', '構築する'],
  ['deploys', 'デプロイする'], ['deploy', 'デプロイする'],
  ['integrates', '統合する'], ['integrate', '統合する'],
  ['transforms', '変換する'], ['translate', '翻訳する'],
  ['produces', '生成する'], ['write', '書く'],
  ['should', 'べきです'], ['can', 'できる'], ['must', 'しなければならない'],

  // Tech nouns
  ['server', 'サーバー'], ['client', 'クライアント'],
  ['frontend', 'フロントエンド'], ['backend', 'バックエンド'],
  ['database', 'データベース'], ['pipeline', 'パイプライン'],
  ['gateway', 'ゲートウェイ'], ['platform', 'プラットフォーム'],
  ['translation', '翻訳'], ['transcription', '文字起こし'],
  ['audio', 'オーディオ'], ['speech', '音声'],
  ['diagram', '図'], ['graph', 'グラフ'],
  ['architecture', 'アーキテクチャ'], ['structure', '構造'],
  ['container', 'コンテナ'], ['orchestration', 'オーケストレーション'],
  ['microphone', 'マイク'], ['intelligence', 'インテリジェンス'],
  ['persistence', '永続性'], ['layer', 'レイヤー'],
  ['encryption', '暗号化'], ['observability', '可観測性'],
  ['caching', 'キャッシュ'], ['connection', '接続'],
  ['message', 'メッセージ'], ['channel', 'チャンネル'],
  ['service', 'サービス'], ['engine', 'エンジン'],
  ['tests', 'テスト'], ['test', 'テスト'],

  // Adjectives & adverbs
  ['live', 'ライブ'], ['complete', '完全な'], ['full', '完全な'],
  ['every', 'すべての'], ['realtime', 'リアルタイム'],
  ['offline', 'オフライン'], ['neural', 'ニューラル'],
  ['first', '最初に'], ['next', '次に'], ['later', '後で'],
  ['now', '今'], ['fully', '完全に'], ['automatically', '自動的に'],

  // Prepositions
  ['with', 'で'], ['for', 'のために'], ['from', 'から'],
  ['to', 'へ'], ['in', 'で'], ['on', 'に'],
  ['through', 'を通じて'], ['into', 'へ'], ['under', '下に'],
]);
DICTIONARIES.set('en→ja', { words: EN_JA });

// ── English → Spanish ────────────────────────────────────
const EN_ES = new Map<string, string>([
  // Pronouns
  ['i', 'yo'], ['we', 'nosotros'], ['you', 'tú'], ['they', 'ellos'],
  ['he', 'él'], ['she', 'ella'], ['it', 'eso'], ['me', 'me'],
  ['my', 'mi'], ['your', 'tu'], ['our', 'nuestro'], ['their', 'su'],
  ['this', 'esto'], ['that', 'eso'], ['these', 'estos'], ['those', 'esos'],

  // Articles & conjunctions
  ['the', 'el'], ['a', 'un'], ['an', 'un'],
  ['and', 'y'], ['or', 'o'], ['but', 'pero'], ['not', 'no'],
  ['if', 'si'], ['then', 'entonces'], ['so', 'así que'],
  ['because', 'porque'], ['also', 'también'],

  // Prepositions
  ['to', 'a'], ['from', 'de'], ['in', 'en'], ['on', 'en'],
  ['with', 'con'], ['for', 'para'], ['of', 'de'], ['at', 'en'],
  ['by', 'por'], ['about', 'sobre'], ['between', 'entre'],
  ['through', 'a través de'], ['into', 'en'], ['without', 'sin'],

  // Common verbs
  ['is', 'es'], ['are', 'son'], ['was', 'fue'], ['were', 'fueron'],
  ['has', 'tiene'], ['have', 'tener'], ['had', 'tenía'],
  ['do', 'hacer'], ['does', 'hace'], ['did', 'hizo'],
  ['can', 'puede'], ['should', 'debería'], ['must', 'debe'],
  ['need', 'necesita'], ['needs', 'necesita'], ['want', 'quiere'],
  ['know', 'sabe'], ['think', 'piensa'], ['say', 'dice'],
  ['use', 'usar'], ['uses', 'usa'], ['make', 'hacer'],
  ['work', 'trabajar'], ['run', 'ejecutar'], ['runs', 'ejecuta'],
  ['connect', 'conectar'], ['connects', 'conecta'],
  ['build', 'construir'], ['deploy', 'desplegar'],
  ['integrate', 'integrar'], ['translate', 'traducir'],
  ['write', 'escribir'], ['improve', 'mejorar'],
  ['feed', 'alimentar'], ['feeds', 'alimenta'],
  ['call', 'llamar'], ['calls', 'llama'],
  ['depend', 'depender'], ['depends', 'depende'],

  // Tech nouns
  ['server', 'servidor'], ['client', 'cliente'],
  ['database', 'base de datos'], ['platform', 'plataforma'],
  ['pipeline', 'tubería'], ['gateway', 'puerta de enlace'],
  ['translation', 'traducción'], ['transcription', 'transcripción'],
  ['audio', 'audio'], ['speech', 'habla'],
  ['diagram', 'diagrama'], ['graph', 'grafo'],
  ['architecture', 'arquitectura'], ['structure', 'estructura'],
  ['container', 'contenedor'], ['microphone', 'micrófono'],
  ['intelligence', 'inteligencia'], ['encryption', 'cifrado'],
  ['caching', 'caché'], ['service', 'servicio'],
  ['layer', 'capa'], ['connection', 'conexión'],
  ['message', 'mensaje'], ['test', 'prueba'], ['tests', 'pruebas'],

  // Adjectives & adverbs
  ['live', 'en vivo'], ['complete', 'completo'], ['full', 'completo'],
  ['every', 'cada'], ['first', 'primero'], ['next', 'siguiente'],
  ['later', 'después'], ['now', 'ahora'], ['fully', 'completamente'],
  ['new', 'nuevo'], ['good', 'bueno'], ['great', 'gran'],
]);
DICTIONARIES.set('en→es', { words: EN_ES });

// ── English → French ─────────────────────────────────────
const EN_FR = new Map<string, string>([
  ['i', 'je'], ['we', 'nous'], ['you', 'vous'], ['they', 'ils'],
  ['he', 'il'], ['she', 'elle'], ['it', 'ça'], ['my', 'mon'],
  ['the', 'le'], ['a', 'un'], ['an', 'un'],
  ['and', 'et'], ['or', 'ou'], ['but', 'mais'], ['not', 'ne pas'],
  ['is', 'est'], ['are', 'sont'], ['was', 'était'], ['has', 'a'],
  ['to', 'à'], ['from', 'de'], ['in', 'dans'], ['on', 'sur'],
  ['with', 'avec'], ['for', 'pour'], ['of', 'de'],
  ['server', 'serveur'], ['client', 'client'], ['database', 'base de données'],
  ['translation', 'traduction'], ['speech', 'parole'],
  ['diagram', 'diagramme'], ['graph', 'graphe'],
  ['architecture', 'architecture'], ['platform', 'plateforme'],
  ['first', 'premièrement'], ['next', 'ensuite'], ['later', 'plus tard'],
  ['now', 'maintenant'], ['fully', 'entièrement'],
  ['use', 'utiliser'], ['uses', 'utilise'],
  ['connect', 'connecter'], ['connects', 'connecte'],
  ['build', 'construire'], ['deploy', 'déployer'],
]);
DICTIONARIES.set('en→fr', { words: EN_FR });

// ── English → German ─────────────────────────────────────
const EN_DE = new Map<string, string>([
  ['i', 'ich'], ['we', 'wir'], ['you', 'du'], ['they', 'sie'],
  ['he', 'er'], ['she', 'sie'], ['it', 'es'], ['my', 'mein'],
  ['the', 'der'], ['a', 'ein'], ['an', 'ein'],
  ['and', 'und'], ['or', 'oder'], ['but', 'aber'], ['not', 'nicht'],
  ['is', 'ist'], ['are', 'sind'], ['was', 'war'], ['has', 'hat'],
  ['to', 'zu'], ['from', 'von'], ['in', 'in'], ['on', 'auf'],
  ['with', 'mit'], ['for', 'für'], ['of', 'von'],
  ['server', 'Server'], ['client', 'Client'], ['database', 'Datenbank'],
  ['translation', 'Übersetzung'], ['speech', 'Sprache'],
  ['diagram', 'Diagramm'], ['graph', 'Graph'],
  ['architecture', 'Architektur'], ['platform', 'Plattform'],
  ['first', 'zuerst'], ['next', 'danach'], ['later', 'später'],
  ['now', 'jetzt'], ['fully', 'vollständig'],
  ['use', 'verwenden'], ['uses', 'verwendet'],
  ['connect', 'verbinden'], ['connects', 'verbindet'],
  ['build', 'bauen'], ['deploy', 'bereitstellen'],
]);
DICTIONARIES.set('en→de', { words: EN_DE });
