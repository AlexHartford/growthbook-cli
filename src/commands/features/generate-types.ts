import * as Fs from 'node:fs'
import * as Path from 'node:path'
import {Command, Flags, ux} from '@oclif/core'
import {getGrowthBookProfileConfigAndThrowForCommand} from '../../utils/config'
import {fetchAllPaginatedFeatures, SimpleFeatureResponse} from '../../utils/http'
import {getCompiledTypeScriptTemplateForFeatures} from '../../utils/templating'
import {
  DEFAULT_GROWTHBOOK_BASE_URL,
  DEFAULT_GROWTHBOOK_PROFILE,
  DEFAULT_GROWTHBOOK_TYPES_DESTINATION,
  GROWTHBOOK_APP_FEATURES_FILENAME,
} from '../../utils/constants'
import {baseGrowthBookCliFlags, checkmark} from '../../utils/cli'

export default class GenerateTypes extends Command {
  static description = 'Generate TypeScript types for all your features'

  static examples = []

  static flags = {
    ...baseGrowthBookCliFlags,
    output: Flags.string({
      char: 'o',
      description: `Output path for the ${GROWTHBOOK_APP_FEATURES_FILENAME} file. All directories in this path should exist. If not provided, the directory ${DEFAULT_GROWTHBOOK_TYPES_DESTINATION} will be created in the current working directory.`,
      required: false,
    }),
  }

  static args = {}

  async run(): Promise<void> {
    const {flags: {
      output,
      apiBaseUrl,
      profile,
    }} = await this.parse(GenerateTypes)

    ux.action.start('Getting GrowthBook config')

    const profileUsed = profile || DEFAULT_GROWTHBOOK_PROFILE
    const config = getGrowthBookProfileConfigAndThrowForCommand(profileUsed, this)
    const baseUrlUsed = apiBaseUrl || config.apiBaseUrl || DEFAULT_GROWTHBOOK_BASE_URL

    ux.action.stop(checkmark)

    const {apiKey} = config

    try {
      ux.action.start('Fetching features')

      const features: SimpleFeatureResponse = await fetchAllPaginatedFeatures(baseUrlUsed, apiKey)
      const typeScriptOutput = getCompiledTypeScriptTemplateForFeatures(features)

      ux.action.stop(checkmark)

      let outputPath = output
      if (!outputPath) {
        outputPath = Path.resolve(process.cwd(), DEFAULT_GROWTHBOOK_TYPES_DESTINATION)

        if (!Fs.existsSync(outputPath)) {
          ux.action.start('Creating output directory')

          Fs.mkdirSync(outputPath)
          Fs.writeFileSync(outputPath + '/.gitkeep', '')

          ux.action.stop(`✔ Created directory ${outputPath}`)
        }
      }

      this.writeTypeScriptFile(outputPath, typeScriptOutput)
    } catch (error) {
      this.error('💥 There was an error fetching the features' + error)
    }
  }

  private writeTypeScriptFile(outputPath: string, typeScriptContents: string) {
    ux.action.start('Writing types to disk')

    try {
      const fullyQualifiedPath = Path.resolve(process.cwd(), outputPath)

      Fs.writeFileSync(fullyQualifiedPath + '/' + GROWTHBOOK_APP_FEATURES_FILENAME, typeScriptContents)

      ux.action.stop(checkmark)
      this.log(`${checkmark} Successfully wrote TypeScript definitions to ${fullyQualifiedPath}`)
    } catch (error) {
      this.error('💥 Could not write TypeScript definition file to disk' + error)
    }
  }
}
