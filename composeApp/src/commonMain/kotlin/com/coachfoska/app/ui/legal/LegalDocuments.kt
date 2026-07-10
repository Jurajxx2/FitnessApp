package com.coachfoska.app.ui.legal

data class LegalDocument(
    val id: String,
    val title: String,
    val updated: String,
    val intro: String,
    val sections: List<LegalSection>
)

data class LegalSection(
    val title: String,
    val body: String
)

object LegalDocumentIds {
    const val Privacy = "privacy"
    const val Terms = "terms"
    const val HealthSafety = "health-safety"
    const val HealthDataConsent = "health-data-consent"
    const val WithdrawalRefunds = "withdrawal-refunds"
    const val AiNotice = "ai-notice"
}

object LegalDocuments {
    private val documents = listOf(
        LegalDocument(
            id = LegalDocumentIds.Privacy,
            title = "Sample Privacy Policy",
            updated = "Draft version: 2026-07-09",
            intro = "This is placeholder legal text for review. Replace bracketed values and have counsel approve the final Czech/Slovak/EU version before launch.",
            sections = listOf(
                LegalSection(
                    "Who we are",
                    "[LEGAL_ENTITY_NAME], [COMPANY_ID], [REGISTERED_ADDRESS] operates Coach Foska. Contact us at [PRIVACY_EMAIL]. If appointed, our data protection contact is [DPO_OR_PRIVACY_CONTACT]."
                ),
                LegalSection(
                    "Data we collect",
                    "We collect account data, authentication data, onboarding answers, body measurements, workout logs, activity logs, meal logs, hydration logs, progress and meal photos, check-in answers, coach chat messages, support messages, device tokens, app diagnostics and security logs."
                ),
                LegalSection(
                    "Health and fitness data",
                    "Some data you provide can reveal health status, fitness level, nutrition habits, injuries, stress, sleep, weight history or body composition. We treat this as sensitive health-related data and use it only for the purposes described here."
                ),
                LegalSection(
                    "Why we use data",
                    "We use data to create and adapt your training and nutrition plan, provide coaching, operate reminders, show progress, respond to support requests, secure the service, maintain records required by law and improve product reliability."
                ),
                LegalSection(
                    "Legal bases",
                    "We process account and service data where necessary to provide the service, comply with law, protect legitimate security interests or with your consent. For health-related data, we rely on your explicit consent unless another GDPR Article 9 condition applies."
                ),
                LegalSection(
                    "Processors and sharing",
                    "We may share data with providers that help us run the service, including Supabase, hosting, email/auth, push notification, payment, analytics, customer support and AI providers. Coaches and admins may access user data only where needed to provide the service."
                ),
                LegalSection(
                    "International transfers",
                    "If a provider processes personal data outside the EEA, we use appropriate safeguards such as adequacy decisions, standard contractual clauses or other safeguards required by law."
                ),
                LegalSection(
                    "Retention",
                    "We keep account and coaching data while your account is active. We delete or anonymise data when it is no longer needed, unless we must keep it for legal, accounting, security or dispute reasons. Set exact periods in [RETENTION_TABLE]."
                ),
                LegalSection(
                    "Your rights",
                    "You may request access, correction, deletion, restriction, portability, objection and withdrawal of consent. You may also complain to your local supervisory authority, including UOOU in the Czech Republic or the Slovak Data Protection Office."
                ),
                LegalSection(
                    "Children",
                    "Coach Foska is not intended for children below the minimum age required by local law. If we rely on consent for a child user, parental authorisation may be required."
                )
            )
        ),
        LegalDocument(
            id = LegalDocumentIds.Terms,
            title = "Sample Terms of Service",
            updated = "Draft version: 2026-07-09",
            intro = "These sample terms are for drafting only. They must match the final business model, pricing, app-store flow and local consumer-law review.",
            sections = listOf(
                LegalSection(
                    "Provider",
                    "Coach Foska is provided by [LEGAL_ENTITY_NAME], [COMPANY_ID], [REGISTERED_ADDRESS]. You can contact support at [SUPPORT_EMAIL]."
                ),
                LegalSection(
                    "Service scope",
                    "The app provides fitness, nutrition, hydration, progress tracking, check-in, coaching chat, reminders and optional AI assistant features. The service is for general wellness and coaching support."
                ),
                LegalSection(
                    "Eligibility",
                    "You must be legally able to use the service and provide accurate information. If you are below the age required by local law, a parent or legal guardian must approve your use where required."
                ),
                LegalSection(
                    "Account security",
                    "You are responsible for keeping access to your email, device and account secure. Tell us promptly if you suspect unauthorised access."
                ),
                LegalSection(
                    "User content",
                    "You are responsible for messages, photos, videos and notes you upload. Do not upload illegal content, third-party personal data without permission, medical emergency information, or content that infringes someone else's rights."
                ),
                LegalSection(
                    "Subscriptions and payment",
                    "If paid plans are offered, the price, billing period, renewal rules, tax treatment, trial terms and cancellation path will be shown before purchase. If Apple or Google handles payment, their billing and refund rules may also apply."
                ),
                LegalSection(
                    "Withdrawal and refunds",
                    "EU consumers may have a statutory withdrawal right for online digital services. See the Withdrawal and Refunds notice for details, including any immediate-service consent and exceptions."
                ),
                LegalSection(
                    "Safety",
                    "You agree to use judgment, follow instructions safely, use appropriate equipment and stop if you feel pain, dizziness, chest pain, faintness, shortness of breath or other concerning symptoms."
                ),
                LegalSection(
                    "No medical advice",
                    "Coach Foska does not provide medical diagnosis, treatment or emergency advice. Always consult a qualified professional where medical, pregnancy, injury, eating-disorder or disease-related questions are involved."
                ),
                LegalSection(
                    "Liability",
                    "Nothing in these terms excludes rights or liability that cannot be excluded under applicable consumer law. Any limitation must be reviewed by counsel, especially for death, injury, negligence, defective digital services or statutory consumer rights."
                ),
                LegalSection(
                    "Changes",
                    "We may update the service and these terms. If a change materially affects your rights, we will provide notice as required by law."
                )
            )
        ),
        LegalDocument(
            id = LegalDocumentIds.HealthSafety,
            title = "Health and Safety Notice",
            updated = "Draft version: 2026-07-09",
            intro = "Read this before using workouts, nutrition plans, check-ins, reminders or AI coaching suggestions.",
            sections = listOf(
                LegalSection(
                    "General wellness only",
                    "Coach Foska is designed for fitness and nutrition coaching support. It is not medical advice, diagnosis, treatment, physical therapy, psychiatric advice or emergency support."
                ),
                LegalSection(
                    "Consult a professional",
                    "Speak with a physician, physiotherapist, registered dietitian or other qualified professional before starting or changing a program if you are pregnant, injured, ill, taking medication, have a heart/metabolic condition, have a history of eating disorder or have any medical limitation."
                ),
                LegalSection(
                    "Stop when unsafe",
                    "Stop exercising and seek appropriate help if you experience pain, dizziness, chest pain, fainting, unusual shortness of breath, severe headache, sudden weakness or any other concerning symptom."
                ),
                LegalSection(
                    "Nutrition boundaries",
                    "Calorie and macro targets are estimates. They are not clinical diet plans and should not be used to treat disease, eating disorders, nutrient deficiencies, allergies or medical conditions without qualified supervision."
                ),
                LegalSection(
                    "Your responsibility",
                    "Use proper technique, suitable equipment and a safe training environment. Do not attempt exercises beyond your ability. If something feels wrong, stop and ask a qualified person."
                )
            )
        ),
        LegalDocument(
            id = LegalDocumentIds.HealthDataConsent,
            title = "Explicit Health Data Consent",
            updated = "Draft version: 2026-07-09",
            intro = "Use this as a separate consent flow, not only as a document in Settings. Store the accepted consent version and timestamp.",
            sections = listOf(
                LegalSection(
                    "Consent text",
                    "I explicitly consent to Coach Foska processing my health, fitness, nutrition, body measurement, check-in, photo and coaching data to create and adapt my fitness and nutrition program, track progress, provide coaching support and operate related app features."
                ),
                LegalSection(
                    "Withdrawal",
                    "I understand that I can withdraw this consent at any time through Settings or by contacting [PRIVACY_EMAIL]. Withdrawal does not affect processing already carried out before withdrawal, but personalised features may stop working."
                ),
                LegalSection(
                    "Separate choices",
                    "Marketing, optional analytics, push notifications and AI processing should each have their own clear choice where legally required. Do not bundle these choices with health-data consent."
                ),
                LegalSection(
                    "Records",
                    "Record user ID, consent version, timestamp, locale and consent text. If the consent text changes materially, ask users to accept the new version."
                )
            )
        ),
        LegalDocument(
            id = LegalDocumentIds.WithdrawalRefunds,
            title = "Withdrawal and Refunds",
            updated = "Draft version: 2026-07-09",
            intro = "This sample assumes EU consumer distance-contract rules. Align it with the final checkout and app-store billing model.",
            sections = listOf(
                LegalSection(
                    "14-day withdrawal right",
                    "If you are an EU consumer and buy Coach Foska online, you may have the right to withdraw from the contract within 14 days from the day the contract is concluded, without giving a reason, unless a legal exception applies."
                ),
                LegalSection(
                    "Immediate service",
                    "If you ask us to start providing the digital service during the withdrawal period, you may be required to acknowledge that this can affect your withdrawal right or create a pro-rata payment obligation, depending on the service and applicable law."
                ),
                LegalSection(
                    "How to withdraw",
                    "Contact [SUPPORT_EMAIL] with your account email and a clear statement that you withdraw from the contract. If required, use the model form published in the legal guide."
                ),
                LegalSection(
                    "Refund timing",
                    "Where a refund is due, we will refund without undue delay and within the period required by applicable law, usually using the same payment method unless agreed otherwise."
                ),
                LegalSection(
                    "App-store purchases",
                    "If your purchase was made through Apple or Google, refunds may need to be requested through the relevant app-store process."
                )
            )
        ),
        LegalDocument(
            id = LegalDocumentIds.AiNotice,
            title = "AI Assistant Notice",
            updated = "Draft version: 2026-07-09",
            intro = "Show this near AI chat and meal-photo analysis when AI features are enabled.",
            sections = listOf(
                LegalSection(
                    "AI interaction",
                    "When you use the AI assistant or photo analysis, you are interacting with an AI system. AI outputs may be incomplete, inaccurate or unsuitable for your situation."
                ),
                LegalSection(
                    "No medical advice",
                    "AI responses are general wellness information only. They are not medical, dietetic, physiotherapy, mental-health or emergency advice."
                ),
                LegalSection(
                    "Human review",
                    "Unless the app clearly says otherwise, AI answers are not automatically reviewed by a human coach. Ask your coach or a qualified professional before relying on important advice."
                ),
                LegalSection(
                    "Sensitive uploads",
                    "Do not upload medical records, identity documents, third-party personal data, emergency information or content you do not have the right to share."
                ),
                LegalSection(
                    "Data processing",
                    "Messages and photos submitted to AI features may be sent to [AI_PROVIDER] or our secure backend to generate a response. Explain the provider, retention and safeguards in the Privacy Policy."
                )
            )
        )
    ).associateBy { it.id }

    fun get(id: String): LegalDocument? = documents[id]
}
