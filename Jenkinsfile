@Library('jenkins-shared-library') _

pipeline {
    agent {
        kubernetes {
            label 'kaniko-agent'
            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: jnlp
    image: jenkins/inbound-agent:3383.vc8881d4b_0e76-1
    env:
      - name: JENKINS_AGENT_WORKDIR
        value: /home/jenkins/agent
    volumeMounts:
      - name: workspace-volume
        mountPath: /home/jenkins/agent

  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command:
      - "/busybox/cat"
    tty: true
    volumeMounts:
      - name: workspace-volume
        mountPath: /home/jenkins/agent

  volumes:
  - name: workspace-volume
    emptyDir: {}
"""
        }
    }

    environment {
        APP_NAME          = 'gold-profit-app'                         // ArgoCD Application
        DOCKER_IMAGE_NAME = 'nguyenphong8852/gold-profit-app'
        IMAGE_TAG         = "${BUILD_NUMBER}"
        MANIFEST_FILE     = 'k8s-manifests/deployment.yaml'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    echo "Building image (Kaniko): ${DOCKER_IMAGE_NAME}:${IMAGE_TAG}"
                }
            }
        }

        stage('Build & Push Image (Kaniko)') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DOCKER_USERNAME',
                        passwordVariable: 'DOCKER_PASSWORD'
                    )
                ]) {
                    container('kaniko') {
                        sh '''
                            set -e

                            echo "Preparing Docker Hub credentials for Kaniko..."
                            mkdir -p /kaniko/.docker

                            cat > /kaniko/.docker/config.json <<EOF
{"auths":{"https://index.docker.io/v1/":{"auth":"$(printf "%s:%s" "$DOCKER_USERNAME" "$DOCKER_PASSWORD" | base64 | tr -d '\\n')"}}}
EOF

                            echo "Building & pushing image with Kaniko..."
                            /kaniko/executor \
                              --dockerfile=$WORKSPACE/Dockerfile \
                              --context=$WORKSPACE \
                              --destination=$DOCKER_IMAGE_NAME:$IMAGE_TAG \
                              --cleanup

                            echo "Kaniko build & push completed."
                        '''
                    }
                }
            }
        }

        stage('Update K8s Manifest') {
            steps {
                updateK8sManifest(
                    DOCKER_IMAGE_NAME,
                    IMAGE_TAG,
                    MANIFEST_FILE,
                    'github-credentials',
                    'https://github.com/phongnt93/gold-profit-app.git'
                )
            }
        }

        stage('Collect ArgoCD Status') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'argocd-credentials',
                        usernameVariable: 'ARGO_USER',
                        passwordVariable: 'ARGO_PASS'
                    )
                ]) {
                    sh '''
set +e

echo "===== Collecting ArgoCD status (best effort) =====" > argocd.log

if ! command -v argocd >/dev/null 2>&1; then
  echo "argocd CLI not found, downloading..." >> argocd.log
  mkdir -p /tmp/argocd-bin
  curl -sSL -o /tmp/argocd-bin/argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
  chmod +x /tmp/argocd-bin/argocd
  export PATH="/tmp/argocd-bin:$PATH"
else
  echo "argocd CLI already available at $(command -v argocd)" >> argocd.log
fi

echo "Using argocd from: $(command -v argocd)" >> argocd.log

echo "Logging into ArgoCD..." >> argocd.log
argocd login argocd-server.argocd.svc.cluster.local \
  --username "${ARGO_USER}" \
  --password "${ARGO_PASS}" \
  --plaintext >> argocd.log 2>&1

echo "" >> argocd.log
echo "===== argocd app get ${APP_NAME} =====" >> argocd.log
argocd app get ${APP_NAME} >> argocd.log 2>&1

exit 0
'''
                }
            }
        }

        /********** AI STAGES **********/

        stage('Prepare AI Log') {
            steps {
                script {
                    def argocdInfo = fileExists('argocd.log')
                        ? readFile('argocd.log')
                        : 'No ArgoCD log captured.'

                    def logText = """
[Pipeline] Project: gold-profit-app

[Checkout]
Source: ${env.GIT_URL ?: 'SCM'}
Branch: ${env.GIT_BRANCH ?: 'main'}
Status: SUCCESS

[Build & Push Image (Kaniko)]
Image: ${DOCKER_IMAGE_NAME}:${IMAGE_TAG}
Status: ${currentBuild.result ?: 'SUCCESS'}

[Update K8s Manifest]
Manifest: ${MANIFEST_FILE}
Git repo: https://github.com/phongnt93/gold-profit-app.git
Status: ${currentBuild.result ?: 'SUCCESS'}

[ArgoCD]
${argocdInfo}

Notes:
- ArgoCD Auto-Sync + Self-Heal are enabled.
- PostSync Job 'gold-profit-smoke-test' runs a smoke test against https://gold-app.local/health.

If there was a failure, infer the most likely stage and root cause from this log.
"""

                    writeFile(
                        file: 'jenkins.log',
                        text: logText
                    )
                }
            }
        }

        stage('Create AI Request') {
            steps {
                script {
                    def log = readFile('jenkins.log')

                    def prompt = """
You are an expert DevOps AI specializing in Jenkins, Docker, Kubernetes, Helm and ArgoCD.

Analyze the combined Jenkins + ArgoCD log and infer:
- overall status
- which stage is failing or risky
- root cause
- short summary for humans
- severity
- suggested actions

Return ONLY ONE valid JSON object.

Do NOT use markdown.

Schema:
{
  "status":"",
  "stage":"",
  "root_cause":"",
  "summary":"",
  "confidence":0,
  "suggested_actions":[],
  "affected_component":"",
  "severity":"LOW|MEDIUM|HIGH|CRITICAL"
}

Log:

${log}
"""

                    writeJSON(
                        file: "ai-request.json",
                        pretty: 4,
                        json: [
                            preset: "fast-search",
                            input : prompt
                        ]
                    )
                }
            }
        }

        stage('Call Perplexity') {
            steps {
                withCredentials([
                    string(
                        credentialsId: 'perplexity-api-key',
                        variable: 'PPLX_API_KEY'
                    )
                ]) {
                    sh '''
curl -sS https://api.perplexity.ai/v1/responses \
  -H "Authorization: Bearer ${PPLX_API_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @ai-request.json \
  -o ai-response.json

echo "========== RAW RESPONSE =========="
cat ai-response.json
'''
                }
            }
        }

        stage('Parse AI Response') {
            steps {
                script {
                    def resp = readJSON file: "ai-response.json"

                    def message = resp.output.find { it.type == "message" }
                    if (message == null) {
                        error("Cannot find message object in response.")
                    }

                    def textBlock = message.content.find { it.type == "output_text" }
                    if (textBlock == null) {
                        error("Cannot find output_text in response.")
                    }

                    echo "=========== AI JSON RAW ==========="
                    echo textBlock.text

                    def ai
                    try {
                        ai = readJSON text: textBlock.text
                    } catch (Exception e) {
                        error("AI output is not valid JSON: ${e.message}\nOutput:\n${textBlock.text}")
                    }

                    writeJSON(
                        file: "ai-summary.json",
                        pretty: 4,
                        json: ai
                    )

                    currentBuild.description = """
${ai.severity} – ${ai.status}

${ai.summary}

Confidence: ${ai.confidence}
"""

                    if (ai.severity in ['HIGH', 'CRITICAL']) {
                        currentBuild.result = 'FAILURE'
                    } else if (ai.severity == 'MEDIUM') {
                        currentBuild.result = 'UNSTABLE'
                    }

                    def html = """
<html>
<head>
<title>AI Analysis</title>
<style>
body{
  font-family:Arial;
  margin:30px;
}
table{
  width:100%;
  border-collapse:collapse;
}
td,th{
  border:1px solid #ddd;
  padding:8px;
}
th{
  background:#efefef;
}
</style>
</head>
<body>

<h2>AI Analysis (Jenkins + ArgoCD – gold-profit-app)</h2>

<table>
<tr><th>Status</th><td>${ai.status}</td></tr>
<tr><th>Stage</th><td>${ai.stage}</td></tr>
<tr><th>Severity</th><td>${ai.severity}</td></tr>
<tr><th>Root Cause</th><td>${ai.root_cause}</td></tr>
<tr><th>Summary</th><td>${ai.summary}</td></tr>
<tr><th>Confidence</th><td>${ai.confidence}</td></tr>
<tr><th>Affected Component</th><td>${ai.affected_component}</td></tr>
</table>

<h3>Suggested Actions</h3>
<ul>
${ai.suggested_actions.collect { ">${it}</li>" }.join("\\n")}
</ul>

</body>
</html>
"""

                    writeFile(
                        file: "ai-summary.html",
                        text: html
                    )
                }
            }
        }

        stage('Publish HTML') {
            steps {
                publishHTML(target: [
                    reportDir: '.',
                    reportFiles: 'ai-summary.html',
                    reportName: 'AI Analysis – gold-profit-app',
                    keepAll: true,
                    alwaysLinkToLastBuild: true
                ])
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: '''
jenkins.log,
argocd.log,
ai-request.json,
ai-response.json,
ai-summary.json,
ai-summary.html
'''
        }

        success {
            echo "CI/CD done (Kaniko): ${DOCKER_IMAGE_NAME}:${IMAGE_TAG} pushed, manifest updated, ArgoCD status captured, AI analysis generated."
        }
        failure {
            echo "Build failed – see AI Analysis and ArgoCD logs for details."
        }
    }
}