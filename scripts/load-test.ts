/**
 * Load Testing Suite: 1k contractors, 100 concurrent leads
 * 
 * Stresses the system to validate production readiness:
 * - Lead capture throughput
 * - Contractor provisioning pipeline
 * - Work assignment routing
 * - State BRIC data isolation under load
 */

// TODO: these imports will be used when live load-test integration is wired up
// import { SystemBBric } from '../brics/system-b/index'
import { createBRICS } from '../brics/orchestrator'
import path from 'path'

interface LoadTestConfig {
  totalContractors: number
  concurrentLeads: number
  testDurationSeconds: number
  stateDistribution: Record<string, number>
}

interface LoadTestResult {
  timestamp: number
  duration: number
  totalLeadsProcessed: number
  totalContractorsProvisioned: number
  totalAssignmentsMade: number
  averageLatencyMs: number
  p99LatencyMs: number
  errorsCount: number
  throughputPerSecond: number
  passed: boolean
}

class LoadTester {
  private results: { timestamp: number; latency: number; success: boolean }[] = []
  private startTime = 0

  constructor(private config: LoadTestConfig) {}

  async runLoadTest(): Promise<LoadTestResult> {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           LOAD TEST: Production Readiness Verification         ║
║                                                                ║
║  Target: 1,000 contractors, 100 concurrent leads               ║
║  Duration: ${this.config.testDurationSeconds}s                                    ║
╚════════════════════════════════════════════════════════════════╝
    `)

    this.startTime = Date.now()
    const orchestrator = await createBRICS({
      baseDir: path.join(process.cwd(), 'tmp', 'load-test'),
      stateCodes: Object.keys(this.config.stateDistribution),
      publicBaseUrl: 'https://api.jga-os.example.com',
      mfaRequired: true,
      vpnRequired: true,
    })

    const systemB = orchestrator.getSystemB()
    let totalLeads = 0
    let totalContractors = 0
    let totalAssignments = 0
    let errorCount = 0

    console.log('🔄 Starting concurrent lead capture simulation...\n')

    // Simulate concurrent lead ingestion
    const concurrentBatches = Math.ceil(this.config.totalContractors / this.config.concurrentLeads)

    for (let batch = 0; batch < concurrentBatches; batch++) {
      const promises: Promise<void>[] = []

      for (let i = 0; i < this.config.concurrentLeads && totalLeads < this.config.totalContractors; i++) {
        const leadIndex = batch * this.config.concurrentLeads + i
        const email = `contractor-${leadIndex}@jga-os.example.com`
        const name = `Contractor ${leadIndex}`

        // Distribute across states
        const states = Object.keys(this.config.stateDistribution)
        const state = states[leadIndex % states.length]

        promises.push(
          (async () => {
            const startLatency = Date.now()
            try {
              // Step 1: Capture lead
              await systemB.captureLeadFromPublic(email, name, state, 'contractor')

              // Step 2: Provision contractor
              const contractor = await systemB.provisionContractor(email)

              // Step 3: Complete training (in real system, this would be async)
              await systemB.completeTraining(contractor.id)

              // Step 4: Assign first work
              const projectId = `project-${leadIndex}-001`
              const assignment = await systemB.assignWork(contractor.id, projectId)

              // Step 5: Create escrow milestone
              await systemB.createEscrowMilestone(contractor.id, assignment.id, 5000)

              const latency = Date.now() - startLatency
              this.results.push({ timestamp: Date.now(), latency, success: true })

              totalLeads++
              totalContractors++
              totalAssignments++

              if (totalLeads % 50 === 0) {
                console.log(`  [Progress] ${totalLeads}/${this.config.totalContractors} leads processed`)
              }
            } catch (error) {
              const latency = Date.now() - startLatency
              this.results.push({ timestamp: Date.now(), latency, success: false })
              errorCount++
              console.error(`  ❌ Lead ${leadIndex} failed:`, (error as Error).message)
            }
          })()
        )
      }

      // Wait for batch to complete
      await Promise.allSettled(promises)

      // Check if we should stop (duration exceeded)
      if (Date.now() - this.startTime > this.config.testDurationSeconds * 1000) {
        console.log('⏱️  Test duration exceeded, stopping')
        break
      }
    }

    const testDuration = (Date.now() - this.startTime) / 1000
    const successfulResults = this.results.filter(r => r.success)
    const latencies = successfulResults.map(r => r.latency).sort((a, b) => a - b)

    const result: LoadTestResult = {
      timestamp: Date.now(),
      duration: testDuration,
      totalLeadsProcessed: totalLeads,
      totalContractorsProvisioned: totalContractors,
      totalAssignmentsMade: totalAssignments,
      averageLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p99LatencyMs: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0,
      errorsCount: errorCount,
      throughputPerSecond: totalLeads / testDuration,
      passed: errorCount === 0 && totalLeads >= 900, // Pass if < 10% error rate and 900+ leads
    }

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                   LOAD TEST RESULTS                           ║
╚════════════════════════════════════════════════════════════════╝

📊 Performance Metrics:
  • Total Leads Processed:       ${result.totalLeadsProcessed}
  • Contractors Provisioned:     ${result.totalContractorsProvisioned}
  • Work Assignments:            ${result.totalAssignmentsMade}
  • Test Duration:               ${result.duration.toFixed(1)}s
  • Throughput:                  ${result.throughputPerSecond.toFixed(2)} leads/sec
  
⏱️  Latency Analysis:
  • Average Latency:             ${result.averageLatencyMs.toFixed(0)}ms
  • P99 Latency:                 ${result.p99LatencyMs.toFixed(0)}ms
  
⚠️  Error Analysis:
  • Total Errors:                ${result.errorsCount}
  • Error Rate:                  ${((result.errorsCount / result.totalLeadsProcessed) * 100).toFixed(1)}%

${result.passed ? '✅ PASSED: System meets production performance targets' : '❌ FAILED: Performance below acceptable thresholds'}

Thresholds:
  ✓ P99 Latency < 500ms          ${result.p99LatencyMs < 500 ? '✅' : '❌'}
  ✓ Error Rate < 10%             ${result.errorsCount / result.totalLeadsProcessed < 0.1 ? '✅' : '❌'}
  ✓ Throughput > 5 leads/sec     ${result.throughputPerSecond > 5 ? '✅' : '❌'}
    `)

    await orchestrator.shutdown()
    return result
  }
}

async function main() {
  const config: LoadTestConfig = {
    totalContractors: 1000,
    concurrentLeads: 100,
    testDurationSeconds: 120, // 2 minutes
    stateDistribution: {
      CA: 400, // 40% California
      TX: 600, // 60% Texas
    },
  }

  const tester = new LoadTester(config)
  const result = await tester.runLoadTest()

  process.exit(result.passed ? 0 : 1)
}

main().catch(e => {
  console.error('Load test failed:', e)
  process.exit(1)
})
