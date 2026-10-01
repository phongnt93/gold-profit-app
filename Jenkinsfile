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

    options {
        // Stage 'Checkout' bên dưới đã checkout rồi, bỏ checkout mặc định cho đỡ fetch 2 lần
        skipDefaultCheckout(true)
    }

    environment {
        APP_NAME          = 'gold-profit-app'                         // ArgoCD Application
        DOCKER_IMAGE_NAME = 'nguyenphong8852/gold-profit-app'
        IMAGE_TAG         = "${BUILD_NUMBER}"
        MANIFEST_FILE     = 'k8s-manifests/deployment.yaml'
        GEMINI_MODEL      = 'gemini-3.5-flash'                        // đổi model tại đây

        // LƯU Ý: không khai báo STATUS_* / ERROR_* ở đây. Biến khai báo trong environment{}
        // được bọc bằng withEnv nên env.X = '...' trong script sẽ KHÔNG ghi đè được.
        // Các biến này do runTracked() tạo ra khi chạy; khi đọc dùng env.STATUS_X ?: 'NOT_RUN'.
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    runTracked('CHECKOUT') {
                        checkout scm
                        echo "Building image (Kaniko): ${DOCKER_IMAGE_NAME}:${IMAGE_TAG}"
                    }
                }
            }
        }

        stage('Build & Push Image (Kaniko)') {
            when { expression { env.STATUS_CHECKOUT == 'SUCCESS' } }
            steps {
                script {
                    runTracked('BUILD') {
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
            }
        }

        stage('Update K8s Manifest') {
            // Chỉ cập nhật manifest khi image đã được push thành công
            when { expression { env.STATUS_BUILD == 'SUCCESS' } }
            steps {
                script {
                    runTracked('MANIFEST') {
                        // Thư viện nhận gitRepo dạng host/path, KHÔNG có https://
                        // -> tự lấy từ remote của repo đang build, nên Jenkinsfile dùng chung được cho nhiều repo
                        def gitRepo = sh(script: 'git config --get remote.origin.url', returnStdout: true)
                                        .trim()
                                        .replaceFirst('^https?://', '')

                        updateK8sManifest(
                            env.DOCKER_IMAGE_NAME,
                            env.IMAGE_TAG,
                            env.MANIFEST_FILE,
                            'github-credentials',
                            gitRepo
                        )
                    }
                }
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
[Pipeline] Project: ${APP_NAME}

[Checkout]
Source: ${env.GIT_URL ?: 'SCM'}
Branch: ${env.GIT_BRANCH ?: 'main'}
Status: ${env.STATUS_CHECKOUT ?: 'NOT_RUN'}
${env.ERROR_CHECKOUT ? 'Error: ' + env.ERROR_CHECKOUT : ''}

[Build & Push Image (Kaniko)]
Image: ${DOCKER_IMAGE_NAME}:${IMAGE_TAG}
Status: ${env.STATUS_BUILD ?: 'NOT_RUN'}
${env.ERROR_BUILD ? 'Error: ' + env.ERROR_BUILD : ''}

[Update K8s Manifest]
Manifest: ${MANIFEST_FILE}
Git repo: ${env.GIT_URL ?: 'SCM'}
Status: ${env.STATUS_MANIFEST ?: 'NOT_RUN'}
${env.ERROR_MANIFEST ? 'Error: ' + env.ERROR_MANIFEST : ''}

[ArgoCD]
${argocdInfo}

Notes:
- Stage status NOT_RUN means the stage was skipped because an earlier stage failed.
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
                            contents        : [[parts: [[text: prompt]]]],
                            generationConfig: [
                                responseMimeType: 'application/json',
                                temperature     : 0.2
                            ]
                        ]
                    )
                }
            }
        }

        stage('Call Gemini') {
            steps {
                withCredentials([
                    string(
                        credentialsId: 'gemini-api-key',
                        variable: 'GEMINI_API_KEY'
                    )
                ]) {
                    sh '''
curl -sS "https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
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
                    def resp
                    try {
                        resp = readJSON file: "ai-response.json"
                    } catch (Exception e) {
                        unstable("AI analysis skipped: cannot parse ai-response.json (${e.message})")
                        return
                    }

                    // API trả lỗi (sai key, hết quota, sai model, ...) -> bỏ qua phân tích AI, không làm vỡ pipeline
                    if (resp.error) {
                        unstable("AI analysis skipped, Gemini API error: ${resp.error.message}")
                        return
                    }

                    // Gộp text của candidate đầu tiên (dùng vòng lặp vì sandbox chặn .find { })
                    def aiText = ''
                    if (resp.candidates) {
                        def first = resp.candidates[0]
                        if (first.content) {
                            for (part in first.content.parts) {
                                if (part.text) {
                                    aiText += part.text
                                }
                            }
                        }
                    }
                    if (!aiText) {
                        unstable("AI analysis skipped: Gemini returned no text (blockReason=${resp.promptFeedback?.blockReason}, finishReason=${resp.candidates ? resp.candidates[0].finishReason : 'n/a'})")
                        return
                    }

                    // Phòng khi model vẫn bọc JSON trong ```json ... ```
                    def cleaned = aiText.trim()
                    if (cleaned.startsWith('```')) {
                        cleaned = cleaned.replaceAll('^```[a-zA-Z]*\\s*', '').replaceAll('\\s*```$', '')
                    }

                    echo "=========== AI JSON RAW ==========="
                    echo cleaned

                    def ai
                    try {
                        ai = readJSON text: cleaned
                    } catch (Exception e) {
                        error("AI output is not valid JSON: ${e.message}\nOutput:\n${cleaned}")
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

                    // Escape HTML để nội dung AI trả về không làm vỡ trang
                    def esc = { v ->
                        def t = (v == null) ? '' : v.toString()
                        return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    }

                    def actionsHtml = ''
                    for (a in ai.suggested_actions) {
                        actionsHtml += '<li>' + esc(a) + '</li>\n'
                    }

                    def html = """
<html>
<head>
<meta charset="UTF-8">
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

<h2>AI Analysis (Jenkins + ArgoCD – ${APP_NAME})</h2>

<table>
<tr><th>Status</th><td>${esc(ai.status)}</td></tr>
<tr><th>Stage</th><td>${esc(ai.stage)}</td></tr>
<tr><th>Severity</th><td>${esc(ai.severity)}</td></tr>
<tr><th>Root Cause</th><td>${esc(ai.root_cause)}</td></tr>
<tr><th>Summary</th><td>${esc(ai.summary)}</td></tr>
<tr><th>Confidence</th><td>${esc(ai.confidence)}</td></tr>
<tr><th>Affected Component</th><td>${esc(ai.affected_component)}</td></tr>
</table>

<h3>Suggested Actions</h3>
<ul>
${actionsHtml}
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
            when { expression { fileExists('ai-summary.html') } }
            steps {
                publishHTML(target: [
                    reportDir: '.',
                    reportFiles: 'ai-summary.html',
                    reportName: "AI Analysis – ${APP_NAME}",
                    keepAll: true,
                    alwaysLinkToLastBuild: true
                ])
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'jenkins.log,argocd.log,ai-request.json,ai-response.json,ai-summary.json,ai-summary.html',
                             allowEmptyArchive: true
        }

        success {
            echo "CI/CD done (Kaniko): ${DOCKER_IMAGE_NAME}:${IMAGE_TAG} pushed, manifest updated, ArgoCD status captured, AI analysis generated."
        }
        failure {
            echo "Build failed – see AI Analysis and ArgoCD logs for details."
        }
    }
}

/**
 * Chạy một khối lệnh, ghi lại trạng thái (SUCCESS/FAILURE) và lỗi vào env.
 * catchError đánh dấu stage + build là FAILURE nhưng KHÔNG dừng pipeline,
 * nên các stage thu thập ArgoCD và phân tích AI vẫn chạy sau khi có lỗi.
 */
def runTracked(String key, Closure body) {
    env."STATUS_${key}" = 'RUNNING'
    catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
        try {
            body()
            env."STATUS_${key}" = 'SUCCESS'
        } catch (err) {
            env."STATUS_${key}" = 'FAILURE'
            def msg = (err.message ?: err.toString()).toString()
            env."ERROR_${key}"  = msg.length() > 500 ? msg.substring(0, 500) : msg
            throw err
        }
    }
}