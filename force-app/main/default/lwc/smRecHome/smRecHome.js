import { LightningElement, track } from 'lwc';
import { NavigationMixin }         from 'lightning/navigation';

export default class SmRecHome extends NavigationMixin(LightningElement) {

    // ══════════════════════════════════════════════
    // STATS
    // ══════════════════════════════════════════════
    @track stats = [
        {
            id     : '1',
            icon   : '👥',
            number : '800+',
            label  : 'Collaborateurs en Tunisie'
        },
        {
            id     : '2',
            icon   : '🌍',
            number : '157',
            label  : 'Pays dans le réseau PwC'
        },
        {
            id     : '3',
            icon   : '🏆',
            number : '50+',
            label  : 'Années d\'expérience'
        },
        {
            id     : '4',
            icon   : '📈',
            number : '364K',
            label  : 'Collaborateurs mondiaux'
        }
    ];

    // ══════════════════════════════════════════════
    // TIMELINE
    // ══════════════════════════════════════════════
    @track timeline = [
        {
            year : '1970',
            text : 'Création du cabinet Price Waterhouse en Tunisie, pionnier des services d\'audit.'
        },
        {
            year : '1998',
            text : 'Fusion avec Coopers & Lybrand pour former PricewaterhouseCoopers.'
        },
        {
            year : '2010',
            text : 'Expansion des services de conseil et de transformation digitale.'
        },
        {
            year : '2018',
            text : 'Lancement du programme New World. New Skills pour la formation continue.'
        },
        {
            year : '2024',
            text : 'Plus de 800 collaborateurs et leader incontesté des Big Four en Tunisie.'
        }
    ];

    // ══════════════════════════════════════════════
    // SERVICES
    // ══════════════════════════════════════════════
    @track services = [
        {
            id   : '1',
            icon : '📊',
            title: 'Audit & Assurance',
            desc : 'Nous offrons des services d\'audit indépendants pour renforcer la confiance des parties prenantes dans les informations financières.',
            tags : ['Audit Financier', 'Audit Interne', 'IFRS']
        },
        {
            id   : '2',
            icon : '💡',
            title: 'Consulting',
            desc : 'Nous accompagnons nos clients dans leur transformation stratégique, organisationnelle et digitale pour créer de la valeur durable.',
            tags : ['Stratégie', 'Digital', 'RH', 'Finance']
        },
        {
            id   : '3',
            icon : '⚖️',
            title: 'Tax & Legal',
            desc : 'Nos experts fiscaux et juridiques vous accompagnent dans la gestion de vos obligations fiscales et la structuration de vos opérations.',
            tags : ['Fiscalité', 'Droit des affaires', 'TVA']
        },
        {
            id   : '4',
            icon : '🤝',
            title: 'Deals',
            desc : 'Nous conseillons nos clients sur les fusions-acquisitions, les restructurations et les transactions financières complexes.',
            tags : ['M&A', 'Due Diligence', 'Valorisation']
        },
        {
            id   : '5',
            icon : '🔒',
            title: 'Cybersécurité',
            desc : 'Protection de vos actifs numériques et accompagnement dans la mise en conformité avec les réglementations en vigueur.',
            tags : ['RGPD', 'ISO 27001', 'Pen Testing']
        },
        {
            id   : '6',
            icon : '🌱',
            title: 'ESG & Développement Durable',
            desc : 'Nous aidons les entreprises à intégrer les critères environnementaux, sociaux et de gouvernance dans leur stratégie.',
            tags : ['RSE', 'Reporting ESG', 'Net Zero']
        }
    ];

    // ══════════════════════════════════════════════
    // BENEFITS
    // ══════════════════════════════════════════════
    @track benefits = [
        {
            id   : '1',
            icon : '🎓',
            title: 'Formation continue',
            desc : 'Accès à des programmes de formation mondiaux et certifications reconnues internationalement.'
        },
        {
            id   : '2',
            icon : '🌍',
            title: 'Mobilité internationale',
            desc : 'Opportunités de missions et de mobilité dans les 157 pays du réseau PwC.'
        },
        {
            id   : '3',
            icon : '📈',
            title: 'Évolution rapide',
            desc : 'Un parcours de carrière structuré avec des promotions méritocratiques et transparentes.'
        },
        {
            id   : '4',
            icon : '🤝',
            title: 'Environnement inclusif',
            desc : 'Une culture d\'entreprise qui valorise la diversité, l\'inclusion et le bien-être au travail.'
        },
        {
            id   : '5',
            icon : '💰',
            title: 'Rémunération compétitive',
            desc : 'Des packages attractifs avec avantages sociaux, bonus et participation aux résultats.'
        },
        {
            id   : '6',
            icon : '🚀',
            title: 'Innovation & Tech',
            desc : 'Accès aux dernières technologies et outils d\'intelligence artificielle et d\'automatisation.'
        }
    ];

    // ══════════════════════════════════════════════
    // SECTEURS
    // ══════════════════════════════════════════════
    @track sectors = [
        { id: '1',  icon: '🏦', name: 'Banque & Finance'        },
        { id: '2',  icon: '🏥', name: 'Santé'                   },
        { id: '3',  icon: '⚡', name: 'Énergie'                 },
        { id: '4',  icon: '🏭', name: 'Industrie'               },
        { id: '5',  icon: '🛒', name: 'Distribution & Retail'   },
        { id: '6',  icon: '📡', name: 'Télécommunications'      },
        { id: '7',  icon: '✈️', name: 'Transport & Logistique'  },
        { id: '8',  icon: '🏗️', name: 'Immobilier & BTP'        },
        { id: '9',  icon: '🎓', name: 'Éducation'               },
        { id: '10', icon: '🌾', name: 'Agriculture & Agro-alimentaire' }
    ];

    // ══════════════════════════════════════════════
    // TESTIMONIALS
    // ══════════════════════════════════════════════
    @track testimonials = [
        {
            id       : '1',
            text     : 'Travailler chez PwC Tunisie m\'a permis de développer des compétences techniques et managériales que je n\'aurais jamais acquises ailleurs. L\'environnement est stimulant et les opportunités sont réelles.',
            name     : 'Sarra Ben Ahmed',
            role     : 'Senior Manager — Audit',
            initiales: 'SB'
        },
        {
            id       : '2',
            text     : 'La mobilité internationale m\'a offert une expérience unique. J\'ai eu la chance de travailler sur des projets en France et aux Émirats. PwC ouvre vraiment les portes du monde.',
            name     : 'Mohamed Trabelsi',
            role     : 'Manager — Advisory',
            initiales: 'MT'
        },
        {
            id       : '3',
            text     : 'Le programme de formation est exceptionnel. Dès mon premier jour, j\'ai eu accès à des modules de formation en ligne et à des mentors expérimentés qui m\'ont guidé dans ma carrière.',
            name     : 'Yasmine Gharbi',
            role     : 'Associate — Tax & Legal',
            initiales: 'YG'
        }
    ];

    // ══════════════════════════════════════════════
    // HANDLERS
    // ══════════════════════════════════════════════
    handleVoirOffres() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: '/smartrec/candidat/offres'
            }
        });
    }

    handleScrollDown() {
        const section = this.template.querySelector('[data-section="about"]');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }
}