import { findMatchingRule } from '../../shared/ruleMatching';

const rules = [
    {
        id: '1',
        matcher: '/alte-Seite/Subpfad/',
        targetUrl: '/new',
        redirectType: 'partial' as const
    }
];

const config = {
    WEIGHT_PATH_SEGMENT: 100,
    WEIGHT_QUERY_PAIR: 50,
    PENALTY_WILDCARD: -10,
    BONUS_EXACT_MATCH: 200,
    CASE_SENSITIVITY_PATH: false,
    DEBUG: false
};

const url1 = 'https://host.com/alte-Seite/Subpfad/';
const match1 = findMatchingRule(url1, rules, config);
console.log('Match 1:', match1 ? 'YES' : 'NO');

const url2 = 'https://host.com/alte-Seite/Subpfad/extra';
const match2 = findMatchingRule(url2, rules, config);
console.log('Match 2:', match2 ? 'YES' : 'NO');
