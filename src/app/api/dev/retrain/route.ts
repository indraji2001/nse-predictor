import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import path from 'path'

// POST /api/dev/retrain
// Executed only in local development environment to retrain LightGBM.
export async function POST(req: NextRequest) {
  // Security guard: Only allow execution locally in development
  if (process.env.NODE_ENV !== 'development' && !process.env.ALLOW_LOCAL_DEV) {
    return NextResponse.json(
      { error: 'Developer tools are restricted to local development environments only.' },
      { status: 403 }
    )
  }

  return new Promise((resolve) => {
    const projectRoot = process.cwd()
    const scriptPath = path.join(projectRoot, 'scripts', 'train.py')
    
    console.log(`Starting machine learning model retraining: python ${scriptPath}`)

    exec(`python "${scriptPath}"`, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Retraining error: ${error.message}`);
        resolve(
          NextResponse.json(
            { error: 'Model training pipeline failed', details: stderr || error.message },
            { status: 500 }
          )
        )
        return
      }

      console.log(`Model training completed: ${stdout}`)
      resolve(
        NextResponse.json({
          status: 'success',
          message: 'LightGBM model successfully retrained on the latest 5 years of daily market candles!',
          output: stdout
        })
      )
    })
  })
}
