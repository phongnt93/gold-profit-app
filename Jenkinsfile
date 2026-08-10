@Library('jenkins-shared-library') _

pipeline {

```
agent any

environment {
    DOCKER_IMAGE_NAME = 'nguyenphong8852/gold-profit-app'
    IMAGE_TAG        = "${BUILD_NUMBER}"
    MANIFEST_FILE    = 'k8s-manifests/deployment.yaml'
    APP_REPO_URL     = 'https://github.com/phongnt93/gold-profit-app.git'
}

stages {

    // =========================================================
    // CHECKOUT
    // =========================================================
    stage('Checkout') {
        steps {

            checkout scm

            script {
                echo "=========================================="
                echo "Application : gold-profit-app"
                echo "Docker Image: ${DOCKER_IMAGE_NAME}:${IMAGE_TAG}"
                echo "Build       : #${BUILD_NUMBER}"
                echo "=========================================="
            }
        }
    }

    // =========================================================
    // BUILD DOCKER IMAGE
    // =========================================================
    stage('Build Docker Image') {
        steps {

            buildDockerImage(
                DOCKER_IMAGE_NAME,
                IMAGE_TAG
            )
        }
    }

    // =========================================================
    // PUSH DOCKER IMAGE
    // =========================================================
    stage('Push to Docker Hub') {
        steps {

            pushToDockerHub(
                DOCKER_IMAGE_NAME,
                IMAGE_TAG,
                'dockerhub-credentials'
            )
        }
    }
}

// =============================================================
// POST
// =============================================================
post {

    // =========================================================
    // SUCCESS
    // =========================================================
    success {

        echo "=========================================="
        echo "✅ Pipeline completed successfully"
        echo "Application : gold-profit-app"
        echo "Image       : ${DOCKER_IMAGE_NAME}:${IMAGE_TAG}"
        echo "=========================================="
    }

    // =========================================================
    // FAILURE
    // =========================================================
    failure {

        script {

            echo "=========================================="
            echo "❌ Jenkins Pipeline FAILED"
            echo "🤖 Starting DevOps AI Agent..."
            echo "=========================================="

            try {

                // =================================================
                // 1. GET REAL JENKINS LOG
                // =================================================

                def fullLog = currentBuild.rawBuild
                    .getLog(15000)
                    .join('\n')

                writeFile(
                    file: 'jenkins-full.log',
                    text: fullLog
                )

                echo "[AI] Full Jenkins log collected."

                // =================================================
                // 2. EXTRACT IMPORTANT ERROR SECTION
                // =================================================

                def lines = fullLog.readLines()

                def importantLines = []

                lines.eachWithIndex { line, index ->

                    def lower = line.toLowerCase()

                    if (
                        lower.contains('error') ||
                        lower.contains('failed') ||
                        lower.contains('failure') ||
                        lower.contains('exception') ||
                        lower.contains('fatal') ||
                        lower.contains('denied') ||
                        lower.contains('timeout') ||
                        lower.contains('unauthorized') ||
                        lower.contains('forbidden') ||
                        lower.contains('not found') ||
                        lower.contains('no such file') ||
                        lower.contains('connection refused') ||
                        lower.contains('exit code') ||
                        lower.contains('exit status')
                    ) {

                        def start = Math.max(0, index - 5)
                        def end   = Math.min(lines.size(), index + 8)

                        for (int i = start; i < end; i++) {

                            if (!importantLines.contains(lines[i])) {
                                importantLines.add(lines[i])
                            }
                        }
                    }
                }

                // =================================================
                // LIMIT EXTRACTED LOG SIZE
                // =================================================

                def extractedLog = importantLines.join('\n')

                if (extractedLog.length() > 30000) {

                    extractedLog =
                        extractedLog.substring(
                            extractedLog.length() - 30000
                        )
                }

                if (!extractedLog?.trim()) {

                    extractedLog =
                        "No obvious error pattern found. Analyze the full log."
                }

                writeFile(
                    file: 'jenkins-error.log',
                    text: extractedLog
                )

                echo "=========================================="
                echo "[AI] Extracted error section"
                echo "=========================================="
                echo extractedLog
                echo "=========================================="

                // =================================================
                // 3. COLLECT DEVOPS DIAGNOSTICS
                // =================================================

                echo "[AI] Collecting DevOps diagnostics..."

                // -------------------------------------------------
                // Git diagnostics
                // -------------------------------------------------

                sh '''
                    set +e

                    echo "===== GIT STATUS =====" \
                        > git-diagnostics.log

                    git status \
                        --short \
                        >> git-diagnostics.log 2>&1

                    echo "" >> git-diagnostics.log
                    echo "===== GIT BRANCH =====" \
                        >> git-diagnostics.log

                    git branch --show-current \
                        >> git-diagnostics.log 2>&1

                    echo "" >> git-diagnostics.log
                    echo "===== GIT LAST COMMIT =====" \
                        >> git-diagnostics.log

                    git log -1 --oneline \
                        >> git-diagnostics.log 2>&1
                '''

                // -------------------------------------------------
                // Docker diagnostics
                // -------------------------------------------------

                sh '''
                    set +e

                    echo "===== DOCKER VERSION =====" \
                        > docker-diagnostics.log

                    docker version \
                        >> docker-diagnostics.log 2>&1

                    echo "" >> docker-diagnostics.log
                    echo "===== DOCKER INFO =====" \
                        >> docker-diagnostics.log

                    docker info \
                        >> docker-diagnostics.log 2>&1

                    echo "" >> docker-diagnostics.log
                    echo "===== IMAGE =====" \
                        >> docker-diagnostics.log

                    docker images \
                        "${DOCKER_IMAGE_NAME}" \
                        >> docker-diagnostics.log 2>&1
                '''

                // -------------------------------------------------
                // Kubernetes diagnostics
                // -------------------------------------------------

                sh '''
                    set +e

                    if command -v kubectl >/dev/null 2>&1; then

                        echo "===== KUBECTL VERSION =====" \
                            > k8s-diagnostics.log

                        kubectl version --client \
                            >> k8s-diagnostics.log 2>&1

                        echo "" >> k8s-diagnostics.log
                        echo "===== KUBECTL CONTEXT =====" \
                            >> k8s-diagnostics.log

                        kubectl config current-context \
                            >> k8s-diagnostics.log 2>&1

                        echo "" >> k8s-diagnostics.log
                        echo "===== PODS =====" \
                            >> k8s-diagnostics.log

                        kubectl get pods -A \
                            -o wide \
                            >> k8s-diagnostics.log 2>&1

                        echo "" >> k8s-diagnostics.log
                        echo "===== RECENT EVENTS =====" \
                            >> k8s-diagnostics.log

                        kubectl get events -A \
                            --sort-by=.lastTimestamp \
                            | tail -100 \
                            >> k8s-diagnostics.log 2>&1

                    else

                        echo "kubectl is not installed." \
                            > k8s-diagnostics.log

                    fi
                '''

                // -------------------------------------------------
                // Helm diagnostics
                // -------------------------------------------------

                sh '''
                    set +e

                    if command -v helm >/dev/null 2>&1; then

                        echo "===== HELM VERSION =====" \
                            > helm-diagnostics.log

                        helm version \
                            >> helm-diagnostics.log 2>&1

                        echo "" >> helm-diagnostics.log
                        echo "===== HELM REPOSITORIES =====" \
                            >> helm-diagnostics.log

                        helm repo list \
                            >> helm-diagnostics.log 2>&1

                        echo "" >> helm-diagnostics.log
                        echo "===== HELM RELEASES =====" \
                            >> helm-diagnostics.log

                        helm list -A \
                            >> helm-diagnostics.log 2>&1

                    else

                        echo "helm is not installed." \
                            > helm-diagnostics.log

                    fi
                '''

                // =================================================
                // 4. COMBINE DIAGNOSTICS
                // =================================================

                sh '''
                    echo "========================================" \
                        > devops-diagnostics.log

                    echo "GIT DIAGNOSTICS" \
                        >> devops-diagnostics.log

                    cat git-diagnostics.log \
                        >> devops-diagnostics.log 2>&1

                    echo "" >> devops-diagnostics.log
                    echo "========================================" \
                        >> devops-diagnostics.log

                    echo "DOCKER DIAGNOSTICS" \
                        >> devops-diagnostics.log

                    cat docker-diagnostics.log \
                        >> devops-diagnostics.log 2>&1

                    echo "" >> devops-diagnostics.log
                    echo "========================================" \
                        >> devops-diagnostics.log

                    echo "KUBERNETES DIAGNOSTICS" \
                        >> devops-diagnostics.log

                    cat k8s-diagnostics.log \
                        >> devops-diagnostics.log 2>&1

                    echo "" >> devops-diagnostics.log
                    echo "========================================" \
                        >> devops-diagnostics.log

                    echo "HELM DIAGNOSTICS" \
                        >> devops-diagnostics.log

                    cat helm-diagnostics.log \
                        >> devops-diagnostics.log 2>&1
                '''

                def diagnostics =
                    readFile('devops-diagnostics.log')

                // =================================================
                // LIMIT DIAGNOSTICS
                // =================================================

                if (diagnostics.length() > 40000) {

                    diagnostics =
                        diagnostics.substring(
                            diagnostics.length() - 40000
                        )
                }

                // =================================================
                // 5. CREATE AI AGENT PROMPT
                // =================================================

                def prompt = """
```

You are an expert DevOps AI Agent.

You specialize in:

* Jenkins
* Linux
* Git
* Docker
* Kubernetes
* Helm
* ArgoCD
* CI/CD
* Networking
* Container troubleshooting

You are analyzing a FAILED Jenkins pipeline.

==================================================
PIPELINE
========

Application:
gold-profit-app

Build:
#${BUILD_NUMBER}

Docker Image:
${DOCKER_IMAGE_NAME}:${IMAGE_TAG}

Manifest:
${MANIFEST_FILE}

Repository:
${APP_REPO_URL}

==================================================
TASK
====

Analyze the failure using:

1. Jenkins error section
2. Git diagnostics
3. Docker diagnostics
4. Kubernetes diagnostics
5. Helm diagnostics

Determine the most likely root cause.

DO NOT simply repeat the error.

Correlate the evidence.

For example:

* Docker authentication failure
* Docker daemon unavailable
* Docker build failure
* Git checkout failure
* Git authentication failure
* Kubernetes pod CrashLoopBackOff
* ImagePullBackOff
* ErrImagePull
* Kubernetes RBAC failure
* Helm release failure
* Helm configuration problem
* Network/DNS failure
* Credential problem
* Resource problem
* Jenkins agent problem

==================================================
IMPORTANT
=========

You are a diagnostic AI Agent.

You MUST distinguish between:

* confirmed evidence
* likely root cause
* possible root cause

Do not claim something is confirmed if the logs do not prove it.

Do not invent Kubernetes resources.

Do not invent Docker images.

Do not invent commands that were executed.

You may recommend commands that an engineer should run.

==================================================
SUGGESTED FIX
=============

Provide concrete remediation steps.

If Kubernetes is involved, suggest appropriate:

kubectl

commands.

If Docker is involved, suggest appropriate:

docker

commands.

If Helm is involved, suggest appropriate:

helm

commands.

If Git is involved, suggest appropriate:

git

commands.

Do NOT perform destructive actions.

Never recommend:

kubectl delete

helm uninstall

docker system prune

or other destructive commands unless explicitly requested.

==================================================
JENKINS ERROR SECTION
=====================

${extractedLog}

==================================================
DEVOPS DIAGNOSTICS
==================

${diagnostics}

==================================================
OUTPUT
======

Return ONLY valid JSON.

No markdown.

No code fences.

No explanation outside JSON.

Schema:

{
"status": "FAILED",
"stage": "",
"root_cause": "",
"evidence": [],
"summary": "",
"confidence": 0,
"affected_component": "",
"severity": "LOW",
"suggested_actions": [],
"recommended_commands": [],
"needs_human_intervention": false
}

Rules:

confidence = integer from 0 to 100

severity must be one of:

LOW
MEDIUM
HIGH
CRITICAL

evidence must contain concrete observations from the logs.

suggested_actions must contain practical remediation steps.

recommended_commands must contain safe diagnostic/remediation commands.

needs_human_intervention must be true when credentials, infrastructure,
permissions, or another manual decision is required.
"""

````
                // =================================================
                // 6. CREATE AI REQUEST
                // =================================================

                writeJSON(
                    file: 'ai-request.json',
                    pretty: 4,
                    json: [
                        model: 'sonar',
                        messages: [
                            [
                                role: 'system',
                                content:
                                    'You are a senior DevOps troubleshooting AI Agent. Return only valid JSON.'
                            ],
                            [
                                role: 'user',
                                content: prompt
                            ]
                        ]
                    ]
                )

                echo "[AI] Created ai-request.json"

                // =================================================
                // 7. CALL PERPLEXITY
                // =================================================

                withCredentials([
                    string(
                        credentialsId: 'perplexity-api-key',
                        variable: 'PPLX_API_KEY'
                    )
                ]) {

                    sh '''
                        set -e

                        echo "=========================================="
                        echo "[AI] Calling Perplexity AI Agent..."
                        echo "=========================================="

                        curl -sS \
                            --fail-with-body \
                            --max-time 120 \
                            https://api.perplexity.ai/chat/completions \
                            -H "Authorization: Bearer ${PPLX_API_KEY}" \
                            -H "Content-Type: application/json" \
                            --data-binary @ai-request.json \
                            -o ai-response.json

                        echo ""
                        echo "[AI] Perplexity response received."
                    '''
                }

                // =================================================
                // 8. PARSE AI RESPONSE
                // =================================================

                def response =
                    readJSON(file: 'ai-response.json')

                if (!response.choices ||
                    response.choices.size() == 0) {

                    error "[AI] Empty Perplexity response."
                }

                def aiText =
                    response.choices[0].message.content

                if (!aiText?.trim()) {

                    error "[AI] AI returned empty content."
                }

                // -------------------------------------------------
                // Remove markdown if model accidentally adds it
                // -------------------------------------------------

                aiText = aiText
                    .replaceAll('```json', '')
                    .replaceAll('```', '')
                    .trim()

                def ai =
                    readJSON(text: aiText)

                // =================================================
                // 9. SAVE AI SUMMARY
                // =================================================

                writeJSON(
                    file: 'ai-summary.json',
                    pretty: 4,
                    json: ai
                )

                // =================================================
                // 10. JENKINS BUILD DESCRIPTION
                // =================================================

                def severity =
                    ai.severity ?: 'UNKNOWN'

                def stage =
                    ai.stage ?: 'Unknown'

                def summary =
                    ai.summary ?: 'No summary provided.'

                def confidence =
                    ai.confidence ?: 0

                currentBuild.description = """
````

🤖 AI DEVOPS ANALYSIS

Severity: ${severity}
Stage: ${stage}
Confidence: ${confidence}%

${summary}
""".trim()

```
                // =================================================
                // 11. HTML REPORT
                // =================================================

                def evidenceHtml = ''

                if (ai.evidence instanceof List) {

                    evidenceHtml =
                        ai.evidence.collect { item ->
                            "<li>${item}</li>"
                        }.join('\n')

                } else {

                    evidenceHtml =
                        '<li>No evidence provided.</li>'
                }

                def actionsHtml = ''

                if (ai.suggested_actions instanceof List) {

                    actionsHtml =
                        ai.suggested_actions.collect { item ->
                            "<li>${item}</li>"
                        }.join('\n')

                } else {

                    actionsHtml =
                        '<li>No suggested actions.</li>'
                }

                def commandsHtml = ''

                if (ai.recommended_commands instanceof List) {

                    commandsHtml =
                        ai.recommended_commands.collect { command ->
                            "<li><code>${command}</code></li>"
                        }.join('\n')

                } else {

                    commandsHtml =
                        '<li>No commands recommended.</li>'
                }

                def html = """
```

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>AI DevOps Analysis</title>

<style>

body {
    font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        sans-serif;

    background: #f5f6f8;
    margin: 0;
    padding: 40px;
}

.container {
    max-width: 1100px;
    margin: auto;
    background: white;
    padding: 35px;
    border-radius: 12px;
}

h1 {
    margin-top: 0;
}

h2 {
    margin-top: 30px;
}

.meta {
    background: #f1f3f5;
    padding: 20px;
    border-radius: 8px;
}

.meta p {
    margin: 8px 0;
}

.label {
    font-weight: bold;
}

.summary {
    font-size: 18px;
    line-height: 1.6;
}

.root-cause {
    background: #fff3cd;
    padding: 20px;
    border-radius: 8px;
    line-height: 1.6;
}

.evidence {
    line-height: 1.8;
}

.actions {
    line-height: 1.8;
}

.commands {
    line-height: 2;
}

code {
    background: #f1f3f5;
    padding: 5px 8px;
    border-radius: 5px;
}

</style>

</head>

<body>

<div class="container">

<h1>🤖 AI DevOps Failure Analysis</h1>

<div class="meta">

<p>
<span class="label">Application:</span>
gold-profit-app
</p>

<p>
<span class="label">Build:</span>
#${BUILD_NUMBER}
</p>

<p>
<span class="label">Failed Stage:</span>
${stage}
</p>

<p>
<span class="label">Severity:</span>
${severity}
</p>

<p>
<span class="label">Confidence:</span>
${confidence}%
</p>

<p>
<span class="label">Affected Component:</span>
${ai.affected_component ?: 'Unknown'}
</p>

<p>
<span class="label">Human Intervention:</span>
${ai.needs_human_intervention ?: false}
</p>

</div>

<h2>Summary</h2>

<div class="summary">

${summary}

</div>

<h2>Root Cause</h2>

<div class="root-cause">

${ai.root_cause ?: 'No root cause provided.'}

</div>

<h2>Evidence</h2>

<ul class="evidence">

${evidenceHtml}

</ul>

<h2>Suggested Fix</h2>

<ul class="actions">

${actionsHtml}

</ul>

<h2>Recommended Commands</h2>

<ul class="commands">

${commandsHtml}

</ul>

</div>

</body>

</html>
"""

```
                writeFile(
                    file: 'ai-summary.html',
                    text: html
                )

                // =================================================
                // 12. PUBLISH REPORT
                // =================================================

                publishHTML(
                    target: [
                        reportDir: '.',
                        reportFiles: 'ai-summary.html',
                        reportName: 'AI DevOps Analysis',
                        keepAll: true,
                        alwaysLinkToLastBuild: true,
                        allowMissing: true
                    ]
                )

                echo "=========================================="
                echo "🤖 AI DevOps analysis completed"
                echo "Severity   : ${severity}"
                echo "Stage      : ${stage}"
                echo "Confidence : ${confidence}%"
                echo "=========================================="

            } catch (Exception e) {

                // =================================================
                // AI FAILURE MUST NOT MASK ORIGINAL FAILURE
                // =================================================

                echo "=========================================="
                echo "⚠️ AI analysis failed"
                echo "Reason: ${e.getMessage()}"
                echo "=========================================="

                writeFile(
                    file: 'ai-error.txt',
                    text: e.toString()
                )
            }
        }
    }

    // =========================================================
    // ALWAYS
    // =========================================================
    always {

        echo "[Pipeline] Archiving diagnostic artifacts..."

        archiveArtifacts(
            artifacts: '''
                jenkins-full.log,
                jenkins-error.log,
                git-diagnostics.log,
                docker-diagnostics.log,
                k8s-diagnostics.log,
                helm-diagnostics.log,
                devops-diagnostics.log,
                ai-request.json,
                ai-response.json,
                ai-summary.json,
                ai-summary.html,
                ai-error.txt
            ''',
            allowEmptyArchive: true,
            fingerprint: true
        )
    }
}
```

}
