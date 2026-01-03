/**
 * 观照（Guanzhao）风险检测关键词库
 * 用于检测用户消息中的风险表达，触发安全流程
 */

// =============================================
// Type Definitions
// =============================================

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'crisis';

export interface RiskDetectionResult {
  level: RiskLevel;
  matchedKeywords: string[];
  confidence: 'low' | 'medium' | 'high';
  suggestions?: string[];
}

// =============================================
// Crisis Keywords (最高风险 - 需要立即干预)
// =============================================

export const CRISIS_KEYWORDS = {
  zh: [
    // 直接表达
    '自杀',
    '想死',
    '不想活了',
    '结束生命',
    '结束自己',
    '了断',
    '不想再活',
    '活着没意义',
    '想离开这个世界',
    '想消失',
    '想解脱',
    '不想存在',

    // 行为计划
    '怎么自杀',
    '自杀方法',
    '如何自杀',
    '自杀方式',
    '想跳楼',
    '想上吊',
    '想割腕',
    '吃安眠药',
    '吃毒药',

    // 告别/准备
    '和你们告别',
    '最后一次',
    '再也见不到',
    '道别',
    '永别',
    '留遗嘱',
    '写遗书',
  ],
  en: [
    // Direct expressions
    'suicide',
    'kill myself',
    'want to die',
    'end my life',
    'end it all',
    'want to end it',
    'no reason to live',
    'want to disappear',
    'want to escape',
    'don\'t want to exist',
    'not worth living',
    'better off dead',

    // Planning
    'how to commit suicide',
    'suicide methods',
    'want to jump',
    'want to hang myself',
    'cut my wrists',
    'overdose',
    'sleeping pills',

    // Goodbye/preparation
    'say goodbye',
    'last time',
    'never see me again',
    'farewell',
    'writing a will',
    'goodbye note',
  ],
};

// =============================================
// High Risk Keywords (高风险 - 需要关注和资源)
// =============================================

export const HIGH_RISK_KEYWORDS = {
  zh: [
    // 伤害自己
    '伤害自己',
    '自残',
    '割伤自己',
    '划伤自己',
    '打自己',
    '伤害自己身体',

    // 绝望感
    '绝望',
    '没有希望',
    '看不到希望',
    '无法承受',
    '撑不下去了',
    '坚持不了',
    '快崩溃了',
    '崩溃边缘',

    // 严重抑郁表达
    '重度抑郁',
    '严重抑郁',
    '想放弃',
    '想放弃一切',
    '没有出路',
    '死胡同',
    '走投无路',

    // 分离感
    '不想活下去',
    '不想再坚持',
    '太累了',
    '很累很累',
    '身心俱疲',
    '精疲力尽',
  ],
  en: [
    // Self-harm
    'hurt myself',
    'self harm',
    'cutting myself',
    'harming myself',
    'injure myself',

    // Hopelessness
    'hopeless',
    'no hope',
    'can\'t see a way out',
    'can\'t take it anymore',
    'can\'t go on',
    'at the end',
    'breaking point',
    'falling apart',

    // Severe depression
    'severely depressed',
    'want to give up',
    'give up on everything',
    'no way out',
    'no exit',
    'cornered',

    // Exhaustion
    'too tired',
    'exhausted',
    'drained',
    'burned out',
  ],
};

// =============================================
// Medium Risk Keywords (中等风险 - 需要观照)
// =============================================

export const MEDIUM_RISK_KEYWORDS = {
  zh: [
    // 情绪困扰
    '很痛苦',
    '很痛苦',
    '痛苦不堪',
    '难过',
    '非常难过',
    '特别难过',
    '伤心欲绝',
    '心碎',

    // 焦虑/压力
    '焦虑',
    '非常焦虑',
    '恐慌',
    '压力很大',
    '压力大',
    '无法承受压力',
    '透不过气',

    // 困惑/迷失
    '不知道怎么办',
    '不知道怎么做',
    '迷失',
    '很迷茫',
    '困惑',
    '很困惑',
    '不知所措',

    // 负面自我评价
    '我很差',
    '我是个失败者',
    '我没用',
    '我什么都不行',
    '我不值得',
  ],
  en: [
    // Emotional distress
    'in pain',
    'hurting',
    'suffering',
    'very sad',
    'extremely sad',
    'heartbroken',
    'devastated',

    // Anxiety/stress
    'anxious',
    'very anxious',
    'panic',
    'too much pressure',
    'overwhelmed',
    'can\'t breathe',
    'stressed out',

    // Confusion/lost
    'don\'t know what to do',
    'lost',
    'confused',
    'at a loss',
    'helpless',

    // Negative self-perception
    'i\'m worthless',
    'i\'m a failure',
    'i\'m useless',
    'i\'m not good at anything',
    'i don\'t matter',
  ],
};

// =============================================
// Low Risk Keywords (低风险 - 记录即可)
// =============================================

export const LOW_RISK_KEYWORDS = {
  zh: [
    '有点难过',
    '心情不好',
    '不开心',
    '有点焦虑',
    '有点压力',
    '有点累',
    '疲惫',
    '沮丧',
    '失落',
    '孤独',
  ],
  en: [
    'a bit sad',
    'feeling down',
    'not happy',
    'a little anxious',
    'some stress',
    'a bit tired',
    'exhausted',
    'frustrated',
    'disappointed',
    'lonely',
  ],
};

// =============================================
// Contextual Analysis Patterns
// =============================================

/**
 * 语境分析模式
 * 用于判断关键词是否真的表达风险
 */
export const CONTEXT_PATTERNS = {
  // 否定模式（降低风险）
  negation: [
    '不是{keyword}',
    '没有{keyword}',
    '不会{keyword}',
    'don\'t {keyword}',
    'not {keyword}',
    'never {keyword}',
  ],

  // 询问/好奇（降低风险）
  inquiry: [
    '为什么{keyword}',
    '如何{keyword}',
    '关于{keyword}',
    'why {keyword}',
    'how {keyword}',
    'about {keyword}',
  ],

  // 第三人称（降低风险）
  thirdPerson: [
    '他{keyword}',
    '她{keyword}',
    '他们{keyword}',
    '别人{keyword}',
    'he {keyword}',
    'she {keyword}',
    'they {keyword}',
    'someone {keyword}',
  ],

  // 过去式/回忆（可能仍需关注）
  past: [
    '曾经{keyword}',
    '以前{keyword}',
    '过去{keyword}',
    'used to {keyword}',
    'in the past {keyword}',
  ],
};

// =============================================
// Risk Detection Function
// =============================================

/**
 * 检测文本中的风险等级
 */
export function detectRiskLevel(
  content: string,
  language: 'zh' | 'en' = 'zh'
): RiskDetectionResult {
  const normalizedContent = content.toLowerCase();

  // 1. 检查危机级别关键词
  const crisisMatches = findMatches(normalizedContent, CRISIS_KEYWORDS[language]);
  if (crisisMatches.length > 0) {
    return {
      level: 'crisis',
      matchedKeywords: crisisMatches,
      confidence: 'high',
      suggestions: getSafetySuggestions(language),
    };
  }

  // 2. 检查高风险关键词
  const highRiskMatches = findMatches(normalizedContent, HIGH_RISK_KEYWORDS[language]);
  if (highRiskMatches.length >= 2) {
    return {
      level: 'high',
      matchedKeywords: highRiskMatches,
      confidence: 'medium',
      suggestions: getHighRiskSuggestions(language),
    };
  }

  // 3. 检查中等风险关键词
  const mediumRiskMatches = findMatches(normalizedContent, MEDIUM_RISK_KEYWORDS[language]);
  if (mediumRiskMatches.length >= 2) {
    return {
      level: 'medium',
      matchedKeywords: mediumRiskMatches,
      confidence: 'low',
    };
  }

  // 4. 检查低风险关键词
  const lowRiskMatches = findMatches(normalizedContent, LOW_RISK_KEYWORDS[language]);
  if (lowRiskMatches.length >= 1) {
    return {
      level: 'low',
      matchedKeywords: lowRiskMatches,
      confidence: 'low',
    };
  }

  // 5. 无风险
  return {
    level: 'none',
    matchedKeywords: [],
    confidence: 'low',
  };
}

/**
 * 在文本中查找匹配的关键词
 */
function findMatches(content: string, keywords: string[]): string[] {
  const matches: string[] = [];

  for (const keyword of keywords) {
    if (content.includes(keyword.toLowerCase())) {
      matches.push(keyword);
    }
  }

  return matches;
}

// =============================================
// Safety Suggestions
// =============================================

function getSafetySuggestions(language: 'zh' | 'en'): string[] {
  if (language === 'zh') {
    return [
      '请立即联系专业心理援助热线',
      '与你信任的人分享你的感受',
      '联系紧急服务：110 或 120',
      '不要独自面对，有人愿意帮助你',
    ];
  }

  return [
    'Please contact a professional helpline immediately',
    'Share your feelings with someone you trust',
    'Contact emergency services: 911 or 988',
    'You don\'t have to face this alone',
  ];
}

function getHighRiskSuggestions(language: 'zh' | 'en'): string[] {
  if (language === 'zh') {
    return [
      '考虑与专业心理咨询师交流',
      '联系你信任的朋友或家人',
      '记住，寻求帮助是勇敢的表现',
    ];
  }

  return [
    'Consider speaking with a professional counselor',
    'Reach out to a trusted friend or family member',
    'Remember, seeking help is a sign of strength',
  ];
}

// =============================================
// Advanced Context Analysis
// =============================================

/**
 * 上下文感知的风险检测
 * 考虑否定模式、第三人称等降低风险的因素
 */
export function detectRiskWithContext(
  content: string,
  language: 'zh' | 'en' = 'zh'
): RiskDetectionResult {
  const baseResult = detectRiskLevel(content, language);

  // 如果无风险或低风险，不需要进一步分析
  if (baseResult.level === 'none' || baseResult.level === 'low') {
    return baseResult;
  }

  // 检查是否在否定模式中
  const hasNegation = checkNegationContext(content, baseResult.matchedKeywords);
  if (hasNegation && baseResult.level !== 'crisis') {
    // 危机级别不降级，其他级别降一级
    const levelMap: Record<string, RiskLevel> = {
      high: 'medium',
      medium: 'low',
      low: 'none',
    };
    return {
      ...baseResult,
      level: levelMap[baseResult.level] || baseResult.level,
    };
  }

  // 检查是否在询问模式中
  const isInquiry = checkInquiryContext(content);
  if (isInquiry && baseResult.level !== 'crisis') {
    const levelMap: Record<string, RiskLevel> = {
      high: 'medium',
      medium: 'low',
      low: 'none',
    };
    return {
      ...baseResult,
      level: levelMap[baseResult.level] || baseResult.level,
    };
  }

  return baseResult;
}

/**
 * 检查否定语境
 */
function checkNegationContext(
  content: string,
  keywords: string[]
): boolean {
  const negationPatterns = CONTEXT_PATTERNS.negation;

  for (const pattern of negationPatterns) {
    for (const keyword of keywords) {
      const testPattern = pattern.replace('{keyword}', keyword);
      if (content.toLowerCase().includes(testPattern.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 检查询问语境
 */
function checkInquiryContext(content: string): boolean {
  const inquiryPatterns = CONTEXT_PATTERNS.inquiry;

  for (const pattern of inquiryPatterns) {
    if (content.toLowerCase().includes(pattern.toLowerCase())) {
      return true;
    }
  }

  return false;
}

// =============================================
// Export All Keywords
// =============================================

export const ALL_KEYWORDS = {
  crisis: CRISIS_KEYWORDS,
  high: HIGH_RISK_KEYWORDS,
  medium: MEDIUM_RISK_KEYWORDS,
  low: LOW_RISK_KEYWORDS,
};

/**
 * 获取所有关键词（用于测试或文档）
 */
export function getAllKeywords(language: 'zh' | 'en' = 'zh'): {
  crisis: string[];
  high: string[];
  medium: string[];
  low: string[];
} {
  return {
    crisis: CRISIS_KEYWORDS[language],
    high: HIGH_RISK_KEYWORDS[language],
    medium: MEDIUM_RISK_KEYWORDS[language],
    low: LOW_RISK_KEYWORDS[language],
  };
}

/**
 * 检查单个关键词的风险级别
 */
export function getKeywordRiskLevel(keyword: string, language: 'zh' | 'en' = 'zh'): RiskLevel {
  const normalizedKeyword = keyword.toLowerCase();

  if (CRISIS_KEYWORDS[language].some(k => k.toLowerCase() === normalizedKeyword)) {
    return 'crisis';
  }

  if (HIGH_RISK_KEYWORDS[language].some(k => k.toLowerCase() === normalizedKeyword)) {
    return 'high';
  }

  if (MEDIUM_RISK_KEYWORDS[language].some(k => k.toLowerCase() === normalizedKeyword)) {
    return 'medium';
  }

  if (LOW_RISK_KEYWORDS[language].some(k => k.toLowerCase() === normalizedKeyword)) {
    return 'low';
  }

  return 'none';
}

// =============================================
// Safety Resources (US-specific)
// =============================================

export const SAFETY_RESOURCES = {
  'US': {
    hotlines: [
      { name: '988 Suicide & Crisis Lifeline', number: '988', available: '24/7' },
      { name: 'Crisis Text Line', number: 'Text HOME to 741741', available: '24/7' },
      { name: 'National Suicide Prevention Lifeline', number: '1-800-273-8255', available: '24/7' },
    ],
    emergency: '911',
  },
  'CN': {
    hotlines: [
      { name: '全国心理援助热线', number: '400-161-9995', available: '24/7' },
      { name: '北京心理危机研究与干预中心', number: '010-82951332', available: '24/7' },
      { name: '紧急服务', number: '110', available: '24/7' },
    ],
    emergency: '110',
  },
  'default': {
    hotlines: [
      { name: 'Local Emergency', number: '112 / 911', available: '24/7' },
    ],
    emergency: '112',
  },
};

/**
 * 根据用户位置获取安全资源
 */
export function getSafetyResources(countryCode: string = 'CN'): typeof SAFETY_RESOURCES['default'] {
  return SAFETY_RESOURCES[countryCode as keyof typeof SAFETY_RESOURCES] || SAFETY_RESOURCES['default'];
}
