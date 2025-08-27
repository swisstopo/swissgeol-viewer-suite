import {
  CustomDataSource,
  GeoJsonDataSource,
  ImageryLayer,
  VoxelPrimitive,
} from 'cesium';
import { PickableCesium3DTileset } from './layers/helpers';
import EarthquakeVisualizer from './earthquakeVisualization/earthquakeVisualizer';
import { LayerTiffController } from 'src/features/layer';
import { AppEnv, ClientConfig } from 'src/api/client-config';
import swissbedrockColorMapAuthor from '../../titiler/colormaps/swissBEDROCK_Author.json';
import swissbedrockColorMapBEM from '../../titiler/colormaps/swissBEDROCK_BEM.json';
import swissbedrockColorMapChange from '../../titiler/colormaps/swissBEDROCK_Change.json';
import swissbedrockColorMapTMUD from '../../titiler/colormaps/swissBEDROCK_TMUD.json';
import swissbedrockColorMapUncertainty from '../../titiler/colormaps/swissBEDROCK_Uncertainty.json';
import swissbedrockColorMapVersion from '../../titiler/colormaps/swissBEDROCK_Version.json';
import i18next from 'i18next';

export type LayerTreeNode =
  | UnspecificLayerTreeNode

  // `GeoTIFFLayer` is the concrete type that we want to use everywhere,
  // `UnspecificLayerTreeNode` is here so it remains compatible with all the old code.
  | (GeoTIFFLayer & UnspecificLayerTreeNode);

interface UnspecificLayerTreeNode {
  type?: LayerType;
  layer?: string;
  label: string;
  assetId?: number;
  ionToken?: string;
  propsOrder?: string[];
  url?: string;
  detailsUrl?: string;
  downloadUrl?: string;
  downloadDataType?: string;
  downloadDataPath?: string;
  geocatId?: string;
  // A "displayed" layer appears in the list of active layers.
  displayed?: boolean;
  // A "visible" layer is actually shown on the globe.
  // Normally, visible => displayed
  visible?: boolean;
  pickable?: boolean;
  opacity?: number;
  opacityDisabled?: boolean;
  style?: any;
  legend?: string;
  backgroundId?: string;
  maximumLevel?: number;
  queryType?: string;
  noQuery?: boolean;
  restricted?: string[];
  aws_s3_bucket?: string;
  aws_s3_key?: string;
  previewColor?: string;
  children?: LayerTreeNode[];
  voxelDataName?: string;
  voxelColors?: VoxelColors;
  voxelFilter?: VoxelFilter;
  customAsset?: boolean;
  wmtsTimes?: string[];
  wmtsCurrentTime?: string;
  env?: Array<AppEnv>;
}

export interface GeoTIFFLayer {
  type: LayerType.geoTIFF;
  url: string;
  layer: string;
  id: string;
  label: string;
  bands: GeoTIFFLayerBand[];
  opacity?: number;
  env?: Array<AppEnv>;

  controller?: LayerTiffController;

  downloadUrl?: string;
  geocatId?: string;

  /**
   * Information about what the TIFF's contents represent.
   */
  metadata: {
    /**
     * The width and height of each of the TIFF's cells, in meters.
     */
    cellSize: number;
  };
}

export interface GeoTIFFLayerBand {
  index: number;
  name: string;
  display?: GeoTIFFDisplay;
  unit?: GeoTIFFUnit;
}

export enum GeoTIFFUnit {
  Meters = 'Meters',
  MetersAboveSeaLevel = 'MetersAboveSeaLevel',
}

export interface GeoTIFFDisplay {
  bounds: [number, number];
  noData?: number;
  colorMap: {
    name: string;
    definition: GeoTIFFColorMap;
  };

  /**
   * Custom steps that are shown on the band's colored legend.
   *
   * If left out, these steps will be calculated from {@link bounds}.
   *
   * If this is string array, the steps will be separated out evenly, and then labeled with the array's elements.
   */
  steps?: string[] | Array<{ value: number; label: string } | number>;

  /**
   * The direction in which steps are ordered.
   * If left out, this defaults to `asc`.
   */
  stepDirection?: 'asc' | 'desc';

  /**
   * Whether each of the band's values is discrete.
   *
   * When this is set to `true`, it is assumed that all values of the band are defined within {@link steps},
   * and there is no interpolation necessary between steps.
   */
  isDiscrete?: boolean;
}

export type GeoTIFFColorMap = Record<string, number[]>;

type LayerInstances =
  | GeoJsonDataSource
  | PickableCesium3DTileset
  | VoxelPrimitive
  | ImageryLayer
  | CustomDataSource
  | EarthquakeVisualizer
  | LayerTiffController;
export type LayerPromise =
  | Promise<GeoJsonDataSource>
  | Promise<PickableCesium3DTileset>
  | Promise<VoxelPrimitive>
  | Promise<ImageryLayer>
  | Promise<CustomDataSource>
  | Promise<EarthquakeVisualizer>
  | Promise<LayerInstances>
  | Promise<LayerTiffController>;

export interface LayerConfig extends UnspecificLayerTreeNode {
  add?: (value: number) => void;
  remove?: () => void;
  setTime?: (time: string) => void;
  heightOffset?: number;
  load?: () => LayerPromise;
  setVisibility?: (value: boolean) => void;
  setOpacity?: (value: number) => void;
  promise?: LayerPromise;
  notSaveToPermalink?: boolean;
  ownKml?: boolean;
  topicKml?: boolean;
  origin?: string;
}

export interface VoxelColors {
  label?: string;
  range: [number, number];
  noData: number;
  undefinedData: number;
  colors: string[];
}

export interface VoxelFilter {
  conductivityRange: [number, number];
  lithologyDataName: string;
  conductivityDataName: string;
}

export interface LithologyVoxelFilter extends VoxelFilter {
  lithology: LithologyFilterItem[];
}

export interface LithologyFilterItem {
  value: number;
  label: string;
}

export enum LayerType {
  swisstopoWMTS = 'swisstopoWMTS',
  tiles3d = '3dtiles',
  voxels3dtiles = 'voxels3dtiles',
  ionGeoJSON = 'ionGeoJSON',
  earthquakes = 'earthquakes',
  geoTIFF = 'geoTIFF',
}

export const DEFAULT_LAYER_OPACITY = 1;

const t = (a: string) => a;

// Property orders
const DOWNLOAD_PROP_ORDER = [
  'Download Move',
  'Download GoCad',
  'Download DXF',
  'Download ASCII',
  'Download All data',
];
const DOWNLOAD_ROOT_GEOMOL = 'https://download.swissgeol.ch/geomol/';
const DOWNLOAD_ROOT_VOXEL = 'https://download.swissgeol.ch/voxel/';
const CENOZOIC_BEDROCK_ORDER = ['Name', 'Horizon', ...DOWNLOAD_PROP_ORDER];
CENOZOIC_BEDROCK_ORDER.splice(6, 0, 'Download ESRI-GRID');
const CONSOLIDATED_ORDER = [
  'Name',
  'Horizon',
  'HARMOS-ORIGINAL',
  ...DOWNLOAD_PROP_ORDER,
];
const FAULTS_ORDER = [
  'Name',
  'Source',
  'Status',
  'Type',
  'Version',
  ...DOWNLOAD_PROP_ORDER,
];
const TEMPERATURE_HORIZON_ORDER = ['name', 'temp_c'];
const TEMPERATURE_HORIZON_BGL_ORDER = ['name', 'temp_c', 'depth_bgl'];
const EARTHQUAKES_PROP_ORDER = [
  'Time',
  'Magnitude',
  'Depthkm',
  'EventLocationName',
  'Details',
];

const voxelNoData = -99999;
const voxelUndefinedData = -9999;

const voxelFilter: VoxelFilter = {
  conductivityRange: [-9, -1],
  lithologyDataName: 'Index',
  conductivityDataName: 'logk',
};

const temperaturVoxelColors: VoxelColors = {
  label: t('Temperature'),
  range: [10, 300],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: [
    'rgb(10, 0, 121)',
    'rgb(40, 0, 150)',
    'rgb(20, 5, 175)',
    'rgb(0, 10, 200)',
    'rgb(0, 25, 212)',
    'rgb(0, 40, 224)',
    'rgb(26, 102, 240)',
    'rgb(13, 129, 248)',
    'rgb(25, 175, 255)',
    'rgb(50, 190, 255)',
    'rgb(68, 202, 255)',
    'rgb(97, 225, 240)',
    'rgb(106, 235, 225)',
    'rgb(124, 235, 200)',
    'rgb(138, 236, 174)',
    'rgb(172, 245, 168)',
    'rgb(205, 255, 162)',
    'rgb(223, 245, 141)',
    'rgb(240, 236, 121)',
    'rgb(247, 215, 104)',
    'rgb(255, 189, 87)',
    'rgb(255, 160, 69)',
    'rgb(244, 117, 75)',
    'rgb(238, 80, 78)',
    'rgb(255, 90, 90)',
    'rgb(255, 124, 124)',
    'rgb(255, 158, 158)',
    'rgb(245, 179, 174)',
    'rgb(255, 196, 196)',
    'rgb(255, 215, 215)',
    'rgb(255, 235, 235)',
    'rgb(255, 255, 255)',
  ],
};

const logkVoxelColors: VoxelColors = {
  range: [-9, -1],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: ['rgb(0, 102, 255)', 'rgb(255, 204, 0)', 'rgb(204, 0, 0)'],
};

const birrIndexVoxelColors: VoxelColors = {
  range: [voxelUndefinedData, 67],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: [
    'rgb(204, 204, 204)', // undefined
    'rgb(225, 81, 194)', // 22
    'rgb(137, 255, 147)', // 46
    'rgb(121, 255, 132)', // 53
    'rgb(0, 255, 234)', // 3
    'rgb(173, 173, 173)', // 16
    'rgb(105, 255, 117)', // 40
    'rgb(143, 143, 143)', // 17
    'rgb(112, 112, 112)', // 38
    'rgb(170, 0, 255)', // 24
    'rgb(89, 255, 102)', // 42
    'rgb(255, 255, 255)', // 61
    'rgb(208, 224, 161)', // 31
    'rgb(72, 255, 88)', // 44
    'rgb(56, 255, 73)', // 26
    'rgb(199, 218, 143)', // 27
    'rgb(255, 255, 255)', // 62
    'rgb(255, 255, 255)', // 60
    'rgb(140, 217, 255)', // 14
    'rgb(128, 212, 255)', // 1
    'rgb(115, 208, 255)', // 34
    'rgb(102, 204, 255)', // 23
    'rgb(77, 195, 255)', // 51
    'rgb(64, 191, 255)', // 8
    'rgb(190, 212, 126)', // 29
    'rgb(181, 206, 108)', // 30
    'rgb(255, 255, 255)', // 13
    'rgb(38, 183, 255)', // 5
    'rgb(40, 255, 58)', // 36
    'rgb(173, 200, 90)', // 2
    'rgb(26, 178, 255)', // 47
    'rgb(13, 175, 255)', // 28
    'rgb(255, 255, 255)', // 21
    'rgb(24, 255, 43)', // 10
    'rgb(0, 170, 255)', // 41
    'rgb(8, 255, 29)', // 11
    'rgb(255, 255, 255)', // 18
    'rgb(0, 153, 230)', // 25
    'rgb(255, 255, 0)', // 48
    'rgb(0, 247, 21)', // 33
    'rgb(0, 231, 19)', // 56
    'rgb(0, 144, 217)', // 12
    'rgb(164, 194, 73)', // 9
    'rgb(108, 129, 43)', // 35
    'rgb(0, 93, 140)', // 49
    'rgb(255, 255, 255)', // 50
    'rgb(0, 215, 18)', // 19
    'rgb(255, 255, 255)', // 39
    'rgb(255, 255, 255)', // 63
    'rgb(0, 127, 191)', // 32
    'rgb(0, 127, 191)', // 64
    'rgb(152, 182, 61)', // 20
    'rgb(0, 199, 17)', // 4
    'rgb(0, 183, 15)', // 45
    'rgb(0, 134, 11)', // 52
    'rgb(0, 166, 14)', // 54
    'rgb(137, 165, 55)', // 37
    'rgb(255, 255, 255)', // 43
    'rgb(0, 110, 166)', // 57
    'rgb(0, 102, 153)', // 15
    'rgb(51, 51, 51)', // 6
    'rgb(0, 150, 13)', // 55
    'rgb(123, 147, 49)', // 7
    'rgb(255, 255, 255)', // 65
    'rgb(255, 255, 255)', // 66
    'rgb(255, 255, 255)', // 67
  ],
};

const birrIndexVoxelFilter: LithologyVoxelFilter = {
  ...voxelFilter,
  lithology: [
    { value: voxelUndefinedData, label: t('vox_filter_undefined_lithology') },
    { value: 22, label: 'künstliche Aufschüttung' },
    { value: 46, label: 'Überschwemmungssedimente' },
    { value: 53, label: 'Verlandungssedimente' },
    { value: 3, label: 'Bachschutt' },
    { value: 16, label: 'Hanglehm' },
    { value: 40, label: 'Schwemmlehm' },
    { value: 17, label: 'Hangschutt' },
    { value: 38, label: 'Rutschungsschutt' },
    { value: 24, label: 'Löss' },
    { value: 42, label: 'Stetten-Lehm' },
    { value: 61, label: 'Eiszeitliche Seesedimente' },
    { value: 31, label: 'Pulveren-Moräne' },
    { value: 44, label: 'Tanklager-Formation' },
    { value: 26, label: 'Mellingen-Lehm' },
    { value: 27, label: 'Mellingen-Moräne' },
    { value: 62, label: 'Mellingen-Schotter' },
    { value: 60, label: 'Birmenstorf-Glazigene Sed.' },
    { value: 14, label: 'Gruemet-Schotter' },
    { value: 1, label: 'Aaretal-Schotter' },
    { value: 34, label: 'Reusstal-Schotter' },
    { value: 23, label: 'Limmattal-Schotter' },
    { value: 51, label: 'Dättwil-Schotter' },
    { value: 8, label: 'Bünztalschotter' },
    { value: 29, label: 'Oberhard-Moräne' },
    { value: 30, label: 'Othmarsingen-Moräne' },
    { value: 13, label: 'Flüefeld-Schotter' },
    { value: 5, label: 'Birr-Schotter' },
    { value: 36, label: 'Rüsshalde-Formation' },
    { value: 2, label: 'Ämmert-Moräne' },
    { value: 47, label: 'Aemmert-Schotter' },
    { value: 28, label: 'Mülligen-Schotter' },
    { value: 21, label: 'Hinterbänkler-Formation' },
    { value: 10, label: 'Dättwil-Lehm' },
    { value: 41, label: 'Seebli-Formation' },
    { value: 11, label: 'Fahracher-Formation' },
    { value: 18, label: 'Hard-Schotter' },
    { value: 25, label: 'Lupfig-Schotter' },
    { value: 48, label: 'Reusstal-Sand' },
    { value: 33, label: 'Reusstal-Lehm' },
    { value: 56, label: 'Vogelsang-Formation' },
    { value: 12, label: 'Fislisbach-Schotter' },
    { value: 9, label: 'Burghalden-Moräne' },
    { value: 35, label: 'Rüfenach-Moräne' },
    { value: 49, label: 'Rüfenach-Schotter' },
    { value: 50, label: 'Ruckfeld-Schotter' },
    { value: 19, label: 'Hausen-Lehm' },
    { value: 39, label: 'Schlattboden-Schotter' },
    { value: 63, label: 'Remigen-Moräne' },
    { value: 32, label: 'Remigen-Schotter' },
    { value: 64, label: 'Remigen-Sediment' },
    { value: 20, label: 'Hausen-Moräne' },
    { value: 4, label: 'Birr-Lehm' },
    { value: 45, label: 'Tannholz-Formation' },
    { value: 52, label: 'Buenztal-Lehm' },
    { value: 54, label: 'Birch-Formation' },
    { value: 37, label: 'Rütenen-Moräne' },
    { value: 43, label: 'Strick-Schotter' },
    { value: 57, label: 'Oetlisberg-Schotter' },
    { value: 15, label: 'Habsburg-Schotter' },
    { value: 6, label: 'Brand-Formation' },
    { value: 55, label: 'Moos-Lehm' },
    { value: 7, label: 'Brand-Moräne' },
    { value: 65, label: 'Riniken-Moräne' },
    { value: 66, label: 'Riniken-Seesedimente' },
    { value: 67, label: 'Bruggerberg-Schotter' },
  ],
};

const aaretalIndexVoxelColors: VoxelColors = {
  range: [voxelUndefinedData, 23],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: [
    'rgb(204, 204, 204)',
    'rgb(92, 255, 105)',
    'rgb(122, 211, 255)',
    'rgb(128, 128, 128)',
    'rgb(0, 255, 234)',
    'rgb(92, 201, 255)',
    'rgb(31, 255, 49)',
    'rgb(179, 204, 102)',
    'rgb(61, 190, 255)',
    'rgb(31, 180, 255)',
    'rgb(0, 170, 255)',
    'rgb(128, 153, 51)',
    'rgb(0, 150, 224)',
    'rgb(0, 224, 19)',
    'rgb(0, 129, 194)',
    'rgb(64, 77, 25)',
    'rgb(0, 163, 14)',
    'rgb(0, 109, 163)',
    'rgb(0, 88, 133)',
    'rgb(255, 255, 0)',
    'rgb(0, 68, 102)',
    'rgb(0, 102, 9)',
  ],
};

const aaretalVoxelFilter: LithologyVoxelFilter = {
  ...voxelFilter,
  lithology: [
    { value: voxelUndefinedData, label: t('vox_filter_undefined_lithology') },
    { value: 3, label: 'Verlandungssedimente, Sumpf, Ried' },
    {
      value: 4,
      label:
        'Subrezente bis rezente Alluvionen (Fluss- und Bachschotter, Überschwemmungssediment, undifferenziert)',
    },
    { value: 5, label: 'Hangschutt / Hanglehm (undifferenziert)' },
    { value: 6, label: 'Bachschutt / Bachschuttkegel (undifferenziert)' },
    { value: 7, label: 'Spät- bis postglaziale Schotter' },
    {
      value: 8,
      label:
        'Spät- bis postglaziale Stausedimente und Seeablagerungen (undifferenziert)',
    },
    { value: 9, label: 'Spätglaziale Moräne (undifferenziert)' },
    {
      value: 10,
      label:
        'Rückzugsschotter der Letzten Vergletscherung ("Felderschotter" und Äquivalente)',
    },
    { value: 11, label: 'Stauschotter (undifferenziert)' },
    { value: 12, label: 'Rinnenschotter' },
    { value: 13, label: 'Moräne der Letzten Vergletscherung' },
    {
      value: 14,
      label:
        'Vorstossschotter der Letzten Vergletscherung (vorwiegend Münsingen- u. Karlsruhe-Schotter)',
    },
    { value: 15, label: 'Interglaziale Seetone (Eemzeitliche Seetone)' },
    {
      value: 16,
      label:
        'Rückzugsschotter der Vorletzten Vergletscherung, Kies-Sand-Komplex von Kleinhöchstetten',
    },
    { value: 17, label: 'Moräne der Vorletzten Vergletscherung ("Altmoräne")' },
    {
      value: 18,
      label:
        'Vorletzteiszeitliche glaziolakustrische Ablagerungen und Schlammmoräne',
    },
    { value: 19, label: 'Alte Deltaschotter im Belpmoos' },
    { value: 20, label: 'Uttigen-Bümberg-Steghalde-Schotter' },
    { value: 21, label: 'Oppligen-Sand' },
    { value: 22, label: 'Raintal-Deltaschotter, Hani-Deltaschotter' },
    { value: 23, label: 'Alte Seetone' },
  ],
};

const genevaIndexVoxelColors: VoxelColors = {
  range: [voxelUndefinedData, 12000],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: [
    'rgb(204, 204, 204)',
    'rgb(55, 169, 0)',
    'rgb(115, 223, 254)',
    'rgb(167, 111, 0)',
    'rgb(0, 94, 230)',
    'rgb(253, 169, 0)',
    'rgb(254, 190, 232)',
    'rgb(150, 120, 255)',
    'rgb(255, 255, 0)',
    'rgb(168, 168, 0)',
    'rgb(255, 235, 191)',
  ],
};

const genevaIndexVoxelFilter: LithologyVoxelFilter = {
  ...voxelFilter,
  lithology: [
    { value: voxelUndefinedData, label: t('vox_filter_undefined_lithology') },
    {
      value: 3000,
      label:
        'Eboulis, Formations de pente, Colluvions, Limons de ruissellement',
    },
    { value: 4000, label: 'Alluvions de terrasses' },
    { value: 5000, label: 'Dépôts ou vases lacustres, tourbe, craie lacustre' },
    { value: 6000, label: 'Formations supraglaciaires de retrait würmiens' },
    { value: 7000, label: 'Moraine würmienne à cailloux et blocs alpins' },
    {
      value: 8000,
      label: 'Dépôts intramorainiques ou intraformationnels würmiens',
    },
    {
      value: 9000,
      label: 'Cailloutis morainiques profonds ou « Alluvion Ancienne »',
    },
    { value: 10000, label: 'Interglaciaire Riss-Würm' },
    { value: 11000, label: 'Formations de retrait rissiens' },
    { value: 12000, label: 'Moraines à cailloux et blocs alpins rissiens' },
  ],
};

const rheintalVoxelColors: VoxelColors = {
  range: [0, 6],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: [
    /* 1 */ 'rgb(0, 0, 255)',
    /* 2 */ 'rgb(30, 144, 255)',
    /* 3 */ 'rgb(173, 216, 230)',
    /* 4 */ 'rgb(144, 238, 144)',
    /* 5 */ 'rgb(255, 165, 0)',
    /* 6 */ 'rgb(255, 255, 0)',
  ],
};

const rheintalVoxelFilter: LithologyVoxelFilter = {
  conductivityDataName: 'Klasse',
  conductivityRange: [0, 6],
  lithologyDataName: 'Klasse',
  lithology: [
    { value: 1, label: t('vox_filter_klasse_1') },
    { value: 2, label: t('vox_filter_klasse_2') },
    { value: 3, label: t('vox_filter_klasse_3') },
    { value: 4, label: t('vox_filter_klasse_4') },
    { value: 5, label: t('vox_filter_klasse_5') },
    { value: 6, label: t('vox_filter_klasse_6') },
  ],
};

const vispIndexVoxelColors: VoxelColors = {
  range: [voxelUndefinedData, 60],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: [
    'rgb(204, 204, 204)', // undefined
    'rgb(255, 0, 150)', // 54
    'rgb(217, 191, 191)', // 14
    'rgb(179, 128, 128)', // 16
    'rgb(128, 77, 77)', // 31
    'rgb(64, 38, 38)', // 30
    'rgb(0, 255, 234)', // 40
    'rgb(0, 255, 234)', // 41
    'rgb(0, 255, 234)', // 44
    'rgb(0, 255, 234)', // 42
    'rgb(0, 255, 234)', // 43
    'rgb(0, 255, 234)', // 45
    'rgb(0, 255, 234)', // 46
    'rgb(0, 255, 234)', // 47
    'rgb(0, 159, 238)', // 48
    'rgb(119, 210, 255)', // 9
    'rgb(216, 255, 197)', // 7
    'rgb(23, 246, 39)', // 8
    'rgb(100, 255, 22)', // 1
    'rgb(73, 219, 0)', // 2
    'rgb(53, 160, 0)', // 3
    'rgb(34, 102, 0)', // 4
    'rgb(199, 207, 175)', // 6
  ],
};

const vispIndexVoxelFilter: LithologyVoxelFilter = {
  ...voxelFilter,
  lithology: [
    { value: voxelUndefinedData, label: t('vox_filter_undefined_lithology') },
    { value: 54, label: 'Künstliche Ablagerung Lonzadeponie' },
    { value: 14, label: 'Gehängeschutt' },
    { value: 16, label: 'Bergsturzmaterial' },
    { value: 31, label: 'Felssackung' },
    { value: 30, label: 'Sackungsmasse Riedberg' },
    { value: 40, label: 'Bachschuttablagerung' },
    { value: 41, label: 'Bachschuttablagerung Baltschiederbach' },
    { value: 44, label: 'Bachschuttablagerung Gamsa' },
    { value: 42, label: 'Bachschuttablagerung Bietschbach' },
    { value: 43, label: 'Bachschuttablagerung Chelchbach' },
    { value: 45, label: 'Bachschuttablagerung Jolibach' },
    { value: 46, label: 'Bachschuttablagerung Lonza' },
    { value: 47, label: 'Bachschuttablagerung Saltina' },
    { value: 48, label: 'Bachschuttablagerung Vispa' },
    { value: 9, label: 'Rhoneschotter und Rhonesande' },
    { value: 7, label: 'Obere Limnische Ablagerungen oli' },
    { value: 8, label: 'Untere Limnische Ablagerungen uli' },
    { value: 1, label: 'Limnische Ablagerungen' },
    { value: 2, label: 'Limnische Ablagerungen 2' },
    { value: 3, label: 'Limnische Ablagerungen 4' },
    { value: 4, label: 'Limnische Ablagerungen 5' },
    { value: 6, label: 'Moränenmaterial' },
  ],
};

export const voxelLayerToFilter: Record<string, LithologyVoxelFilter> = {
  voxel_birrfeld_litho: birrIndexVoxelFilter,
  voxel_birrfeld_logk: birrIndexVoxelFilter,
  voxel_aaretal_litho: aaretalVoxelFilter,
  voxel_aaretal_logk: aaretalVoxelFilter,
  voxel_geneva_litho: genevaIndexVoxelFilter,
  voxel_geneva_logk: genevaIndexVoxelFilter,
  voxel_rheintal_klasse: rheintalVoxelFilter,
  voxel_visp_litho: vispIndexVoxelFilter,
  voxel_visp_logk: vispIndexVoxelFilter,
};

// Layers

const group_01: LayerTreeNode =
  // Topic - Maps, cross-sections & models
  {
    label: t('grp_1786_label'),
    children: [
      {
        // TUSM
        type: LayerType.tiles3d,
        assetId: 3669308,
        label: t('lyr_top_usm_label'),
        layer: 'top_usm',
        opacity: DEFAULT_LAYER_OPACITY,
        pickable: true,
        propsOrder: CONSOLIDATED_ORDER,
        downloadUrl:
          DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-LowerFreshwaterMolasse.zip',
        geocatId: '2d7a0729-dd29-40fa-ad4f-b09f94b7fb00',
        previewColor: '#cdd0d0',
      },
      {
        // TUMM
        type: LayerType.tiles3d,
        assetId: 3564204,
        label: t('lyr_top_umm_label'),
        layer: 'top_umm',
        opacity: DEFAULT_LAYER_OPACITY,
        pickable: true,
        propsOrder: CONSOLIDATED_ORDER,
        downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-LowerMarineMolasse.zip',
        geocatId: 'fedb8d24-a000-4b78-9e6e-fb90305ad3ea',
        previewColor: '#d3cfc0',
      },
      {
        // BCen
        type: LayerType.tiles3d,
        assetId: 3564229,
        label: t('lyr_base_cenozoic_label'),
        layer: 'base_cenozoic',
        opacity: DEFAULT_LAYER_OPACITY,
        pickable: true,
        propsOrder: CENOZOIC_BEDROCK_ORDER,
        downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Base-Cenozoic.zip',
        geocatId: '0e780e6c-18e2-4014-ad16-b35124706580',
        previewColor: '#d6d91a',
      },

      // Topic - Geological maps
      {
        label: t('grp_1787_label'),
        children: [
          // Layer - GeoCover - Vector Datasets - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geocover_label'),
            layer: 'ch.swisstopo.geologie-geocover',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '2467ab13-e794-4c13-8c55-59fe276398c5',
            legend: 'ch.swisstopo.geologie-geocover',
          },
          // Layer - Geological Atlas GA25 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geologischer_atlas_label'),
            layer: 'ch.swisstopo.geologie-geologischer_atlas',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '258814a5-8fcf-47df-b0c6-160602b0078c',
            legend: 'ch.swisstopo.geologie-geologischer_atlas',
          },
          // Layer - Lithology 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_geotechnik_gk500_lithologie_hauptgruppen_label',
            ),
            layer:
              'ch.swisstopo.geologie-geotechnik-gk500-lithologie_hauptgruppen',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '435522fb-599e-41c0-a7c0-49d922ea6acf',
            legend:
              'ch.swisstopo.geologie-geotechnik-gk500-lithologie_hauptgruppen',
          },
          // Layer - Geology 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geologische_karte_label'),
            layer: 'ch.swisstopo.geologie-geologische_karte',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'ca917a71-dcc9-44b6-8804-823c694be516',
            legend: 'ch.swisstopo.geologie-geologische_karte',
          },
          // Layer - Tectonics 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_tektonische_karte_label'),
            layer: 'ch.swisstopo.geologie-tektonische_karte',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'a4cdef47-505e-41ab-b6a7-ad5b92d80e41',
            legend: 'ch.swisstopo.geologie-tektonische_karte',
          },
          // Layer - Groups of rocks 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_geotechnik_gk500_gesteinsklassierung_label',
            ),
            layer: 'ch.swisstopo.geologie-geotechnik-gk500-gesteinsklassierung',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'f2c81b93-f0c5-4899-83a9-974ce36c48e6',
            legend:
              'ch.swisstopo.geologie-geotechnik-gk500-gesteinsklassierung',
          },
          // Layer - Origin of rocks 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geotechnik_gk500_genese_label'),
            layer: 'ch.swisstopo.geologie-geotechnik-gk500-genese',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '65652bdd-76e3-4df2-9329-140a04a2a66c',
            legend: 'ch.swisstopo.geologie-geotechnik-gk500-genese',
          },
        ],
      },
      // Topic - Thematic maps
      {
        label: t('grp_1793_label'),
        children: [
          // Layer - Last glacial maximum (map) 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_eiszeit_lgm_raster_label'),
            layer: 'ch.swisstopo.geologie-eiszeit-lgm-raster',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'f1455593-7571-48b0-8603-307ec59a6702',
            legend: 'ch.swisstopo.geologie-eiszeit-lgm-raster',
          },
          // Layer - Last glacial maximum (vector) 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_eiszeit_lgm_label'),
            layer: 'ch.swisstopo.geologie-eiszeit-lgm',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '75c2f212-413c-4d55-8a93-c021c8bbfc95',
            legend: 'ch.swisstopo.geologie-eiszeit-lgm',
          },
          // Layer - Glacier thickness - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_gletschermaechtigkeit_label'),
            layer: 'ch.swisstopo.geologie-gletschermaechtigkeit',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '57052989-5074-4841-abb6-22d1989d615f',
            legend: 'ch.swisstopo.geologie-gletschermaechtigkeit',
          },
          // Layer - Extent of glaciers - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_gletscherausdehnung_label'),
            layer: 'ch.swisstopo.geologie-gletscherausdehnung',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'f6fb6139-f13e-4a56-bf01-01b7dd4358d5',
            legend: 'ch.swisstopo.geologie-gletscherausdehnung',
          },
          // Layer - Overview of geomorphology - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomorphologie_label'),
            layer: 'ch.swisstopo.geologie-geomorphologie',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '1bf16162-a44c-4970-9da1-044383bacff8',
            legend: 'ch.swisstopo.geologie-geomorphologie',
          },
        ],
      },
      // Topic - Historical maps
      {
        label: t('grp_15174_label'),
        children: [
          // Layer - General Geol. Map 200 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_generalkarte_ggk200_label'),
            layer: 'ch.swisstopo.geologie-generalkarte-ggk200',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'f6416e51-bf55-445a-946e-3eee2134d131',
            legend: 'ch.swisstopo.geologie-generalkarte-ggk200',
          },
        ],
      },
      // Topic - Sheet divisions
      {
        label: t('grp_1799_label'),
        children: [
          // Layer - Division GGK 200 Raster - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_generalkarte_ggk200_metadata_label',
            ),
            layer: 'ch.swisstopo.geologie-generalkarte-ggk200.metadata',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'c17ba742-9a43-4ed2-9331-e776d6e9065d',
            legend: 'ch.swisstopo.geologie-generalkarte-ggk200.metadata',
          },
          // Layer - Division GSK Raster - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_spezialkarten_schweiz_metadata_label',
            ),
            layer: 'ch.swisstopo.geologie-spezialkarten_schweiz.metadata',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '5a7e79b5-0aef-4514-9df4-62fb92edee97',
            legend: 'ch.swisstopo.geologie-spezialkarten_schweiz.metadata',
          },
          // Layer - Division GSK Vector - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_spezialkarten_schweiz_vector_metadata_label',
            ),
            layer:
              'ch.swisstopo.geologie-spezialkarten_schweiz_vector.metadata',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'b15b89ac-d7e5-412c-bd4a-5077c935806c',
            legend:
              'ch.swisstopo.geologie-spezialkarten_schweiz_vector.metadata',
          },
          // Layer - Division GA25 Raster - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_geologischer_atlas_metadata_label',
            ),
            layer: 'ch.swisstopo.geologie-geologischer_atlas.metadata',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'a891e1e7-7f85-4c92-94d9-7120edf91a9c',
            legend: 'ch.swisstopo.geologie-geologischer_atlas.metadata',
          },
          // Layer - Division GeoCover - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geocover_metadata_label'),
            layer: 'ch.swisstopo.geologie-geocover.metadata',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'f7485f4f-2224-4b76-a43c-52cbf8883a42',
            legend: 'ch.swisstopo.geologie-geocover.metadata',
          },
        ],
      },
      // Topic - Cross-sections
      {
        label: t('grp_15143_label'),
        children: [
          // Layer - Geological profiles GA25 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_geologischer_atlas_profile_label',
            ),
            layer: 'ch.swisstopo.geologie-geologischer_atlas_profile',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '345d02a3-9628-46d7-9e57-e0ab1d9faf8a',
            legend: 'ch.swisstopo.geologie-geologischer_atlas_profile',
          },
          // Layer - Cross sections GeoMol
          {
            type: LayerType.tiles3d,
            assetId: 452436,
            label: t('lyr_cross_section_geomol_label'),
            layer: 'cross_section_geomol',
            opacity: DEFAULT_LAYER_OPACITY,
            visible: false,
            displayed: false,
            pickable: true,
            geocatId: '2cec200c-a47b-4934-8dc1-62c19c39a3dd',
            downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Cross-Sections.zip',
          },
          // Layer - Cross sections GeoQuat
          {
            type: LayerType.tiles3d,
            assetId: 472446,
            label: t('lyr_cross_section_geoquat_label'),
            layer: 'cross_section_geoquat',
            opacity: DEFAULT_LAYER_OPACITY,
            visible: false,
            displayed: false,
            pickable: true,
            propsOrder: [
              'CS-AAT-Cross-section',
              'CS-AAT-Lithostratigraphy',
              'CS-AAT-Type',
              'CS-AAT-Legend',
              'CS-AAT-Report',
            ],
            geocatId: 'ab34eb52-30c4-4b69-840b-ef41f47f9e9a',
          },
        ],
      },
      // Topic - 3D models
      {
        label: t('grp_1855_label'),
        children: [
          // Layer - 3D geological models - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geologische_3dmodelle_label'),
            layer: 'ch.swisstopo.geologie-geologische_3dmodelle',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '11836d3b-181e-4078-b83f-f55fc44b5776',
            legend: 'ch.swisstopo.geologie-geologische_3dmodelle',
          },
          {
            // Sub-Group II "Unconsolidated rocks"
            label: t('lyr_unconsolidated_rocks_label'),
            children: [
              {
                // Layer "Voxel-Aaretal"
                type: LayerType.voxels3dtiles,
                url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-Aaretal-Combined/tileset.json',
                voxelDataName: 'Index',
                voxelColors: aaretalIndexVoxelColors,
                voxelFilter: aaretalVoxelFilter,
                label: t('lyr_voxel_aaretal_litho_label'),
                layer: 'voxel_aaretal_litho',
                opacityDisabled: true,
                pickable: true,
                downloadUrl:
                  DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Aaretal-Legende.pdf',
                geocatId: 'b1a36f66-638a-4cfb-88d3-b0df6c7a7502',
              },
              {
                type: LayerType.voxels3dtiles,
                url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-Aaretal-Combined/tileset.json',
                voxelDataName: 'logk',
                voxelColors: logkVoxelColors,
                voxelFilter: aaretalVoxelFilter,
                label: t('lyr_voxel_aaretal_logk_label'),
                layer: 'voxel_aaretal_logk',
                opacityDisabled: true,
                pickable: true,
                downloadUrl:
                  DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Aaretal-Legende.pdf',
                geocatId: '9471ee1b-5811-489d-b050-612c011f9d57',
              },
              {
                type: LayerType.voxels3dtiles,
                url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-BIRR-Combined/tileset.json',
                voxelDataName: 'Index',
                voxelColors: birrIndexVoxelColors,
                voxelFilter: birrIndexVoxelFilter,
                label: t('lyr_voxel_birrfeld_litho_label'),
                layer: 'voxel_birrfeld_litho',
                opacityDisabled: true,
                pickable: true,
                downloadUrl:
                  DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Birrfeld-Legende.pdf',
                geocatId: 'f56c9c6c-ff59-463d-ba66-477fd2d92f39',
              },
              {
                type: LayerType.voxels3dtiles,
                url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-BIRR-Combined/tileset.json',
                voxelDataName: 'logk',
                voxelColors: logkVoxelColors,
                voxelFilter: birrIndexVoxelFilter,
                label: t('lyr_voxel_birrfeld_logk_label'),
                layer: 'voxel_birrfeld_logk',
                opacityDisabled: true,
                pickable: true,
                downloadUrl:
                  DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Birrfeld-Legende.pdf',
                geocatId: '96f923d6-a747-481b-a0d8-2cfec321170e',
              },
              {
                type: LayerType.voxels3dtiles,
                url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-GENF-Combined/tileset.json',
                voxelDataName: 'Index',
                voxelColors: genevaIndexVoxelColors,
                voxelFilter: genevaIndexVoxelFilter,
                label: t('lyr_voxel_geneva_litho_label'),
                layer: 'voxel_geneva_litho',
                opacityDisabled: true,
                pickable: true,
                downloadUrl:
                  DOWNLOAD_ROOT_VOXEL + 'legends/Vox-GVA-Legende.pdf',
                geocatId: '697f4c99-ed1b-4901-bc87-3710fcce1352',
              },
              {
                type: LayerType.voxels3dtiles,
                url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-GENF-Combined/tileset.json',
                voxelDataName: 'logk',
                voxelColors: logkVoxelColors,
                voxelFilter: genevaIndexVoxelFilter,
                label: t('lyr_voxel_geneva_logk_label'),
                layer: 'voxel_geneva_logk',
                opacityDisabled: true,
                pickable: true,
                downloadUrl:
                  DOWNLOAD_ROOT_VOXEL + 'legends/Vox-GVA-Legende.pdf',
                geocatId: '4a4a530f-6a2a-423d-834e-2831d70fde20',
              },
              {
                type: LayerType.voxels3dtiles,
                url: 'https://download.swissgeol.ch/testvoxel/test20250113_KTSGRhein/2025-03-21/output/tileset.json',
                voxelDataName: 'Klasse',
                voxelColors: rheintalVoxelColors,
                voxelFilter: rheintalVoxelFilter,
                label: t('lyr_voxel_rheintal_klasse_label'),
                layer: 'voxel_rheintal_klasse',
                opacityDisabled: true,
                pickable: true,
                geocatId: 'c12c8e4e-4c06-41c9-b705-f1dadb0654ae-8371',
              },
              {
                type: LayerType.voxels3dtiles,
                url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-VISP-Combined/tileset.json',
                voxelDataName: 'Index',
                voxelColors: vispIndexVoxelColors,
                voxelFilter: vispIndexVoxelFilter,
                label: t('lyr_voxel_visp_litho_label'),
                layer: 'voxel_visp_litho',
                opacityDisabled: true,
                pickable: true,
                downloadUrl:
                  DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Visp-Legende.pdf',
                geocatId: 'b621de46-2553-4fb2-88b4-f770e0243299',
              },
              {
                type: LayerType.voxels3dtiles,
                url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-VISP-Combined/tileset.json',
                voxelDataName: 'logk',
                voxelColors: logkVoxelColors,
                voxelFilter: vispIndexVoxelFilter,
                label: t('lyr_voxel_visp_logk_label'),
                layer: 'voxel_visp_logk',
                opacityDisabled: true,
                pickable: true,
                downloadUrl:
                  DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Visp-Legende.pdf',
                geocatId: 'f7847c2c-bd3a-4dda-99c7-d50453b24c3d',
              },
            ],
          },
          {
            // Top bedrock
            label: t('lyr_top_bedrock_surface_label'),
            children: [
              {
                // Layer Top Bedrock Geotiff
                type: LayerType.geoTIFF,
                url: 'https://download.swissgeol.ch/swissbedrock/release_01/swissBEDROCK_R1.tif',
                layer: 'ch.swisstopo.swissbedrock-geotiff',
                id: 'swissBEDROCK',
                label: t('layers:swissBEDROCK.title'),
                opacity: 0.5,
                get downloadUrl(): string {
                  return `https://www.swisstopo.admin.ch/${i18next.language}/swissbedrock-${i18next.language}`;
                },
                geocatId: 'f7836146-3f9a-4807-9011-618800409236',
                bands: [
                  {
                    index: 1,
                    name: 'BEM',
                    unit: GeoTIFFUnit.MetersAboveSeaLevel,
                    display: {
                      bounds: [-433, 4535],
                      steps: [
                        { value: -400, label: '<-400' },
                        500,
                        1000,
                        2500,
                        3000,
                        { value: 4500, label: '>4500' },
                      ],
                      stepDirection: 'desc',
                      colorMap: {
                        name: 'swissBEDROCK_BEM',
                        definition: swissbedrockColorMapBEM as GeoTIFFColorMap,
                      },
                    },
                  },
                  {
                    index: 2,
                    name: 'TMUD',
                    unit: GeoTIFFUnit.Meters,
                    display: {
                      bounds: [-1, 800],
                      noData: 0,
                      steps: [3, 10, 50, 100, 200, 800],
                      colorMap: {
                        name: 'swissBEDROCK_TMUD',
                        definition: swissbedrockColorMapTMUD as GeoTIFFColorMap,
                      },
                    },
                  },
                  {
                    index: 3,
                    name: 'Uncertainty',
                    unit: GeoTIFFUnit.Meters,
                    display: {
                      bounds: [0, 25],
                      colorMap: {
                        name: 'swissBEDROCK_Uncertainty',
                        definition:
                          swissbedrockColorMapUncertainty as GeoTIFFColorMap,
                      },
                    },
                  },
                  {
                    index: 4,
                    name: 'Version',
                    display: {
                      bounds: [221104, 250519],
                      isDiscrete: true,
                      colorMap: {
                        name: 'swissBEDROCK_Version',
                        definition:
                          swissbedrockColorMapVersion as GeoTIFFColorMap,
                      },
                    },
                  },
                  {
                    index: 5,
                    name: 'Author',
                    display: {
                      bounds: [1, 6],
                      steps: ['swisstopo', 'BE', 'GE', 'GLAMOS', 'VD', 'ZG'],
                      isDiscrete: true,
                      colorMap: {
                        name: 'swissBEDROCK_Author',
                        definition:
                          swissbedrockColorMapAuthor as GeoTIFFColorMap,
                      },
                    },
                  },
                  {
                    index: 6,
                    name: 'Change',
                    unit: GeoTIFFUnit.Meters,
                    display: {
                      bounds: [-30, 30],
                      colorMap: {
                        name: 'swissBEDROCK_Change',
                        definition:
                          swissbedrockColorMapChange as GeoTIFFColorMap,
                      },
                    },
                  },
                  {
                    index: 7,
                    name: 'prev_BEM',
                    unit: GeoTIFFUnit.MetersAboveSeaLevel,
                    display: {
                      bounds: [-433, 4535],
                      steps: [-400, 500, 1000, 2500, 3000, 4500],
                      stepDirection: 'desc',
                      colorMap: {
                        name: 'swissBEDROCK_BEM',
                        definition: swissbedrockColorMapBEM as GeoTIFFColorMap,
                      },
                    },
                  },
                  {
                    index: 8,
                    name: 'prev_TMUD',
                    unit: GeoTIFFUnit.Meters,
                    display: {
                      bounds: [0, 800],
                      steps: [3, 10, 50, 100, 200, 800],
                      colorMap: {
                        name: 'swissBEDROCK_TMUD',
                        definition: swissbedrockColorMapTMUD as GeoTIFFColorMap,
                      },
                    },
                  },
                  {
                    index: 9,
                    name: 'prev_Uncertainty',
                    unit: GeoTIFFUnit.Meters,
                    display: {
                      bounds: [0, 25],
                      colorMap: {
                        name: 'swissBEDROCK_Uncertainty',
                        definition:
                          swissbedrockColorMapUncertainty as GeoTIFFColorMap,
                      },
                    },
                  },
                  {
                    index: 10,
                    name: 'prev_Version',
                  },
                  {
                    index: 11,
                    name: 'prev_Author',
                    display: {
                      bounds: [1, 6],
                      steps: ['swisstopo', 'BE', 'GE', 'GLAMOS', 'VD', 'ZG'],
                      isDiscrete: true,
                      colorMap: {
                        name: 'swissBEDROCK_Author',
                        definition:
                          swissbedrockColorMapAuthor as GeoTIFFColorMap,
                      },
                    },
                  },
                ],
                metadata: {
                  cellSize: 10,
                },
              } satisfies GeoTIFFLayer,
            ],
          },
          {
            //Consolidated rocks
            label: t('lyr_consolidated_rocks_label'),
            children: [
              {
                type: LayerType.tiles3d,
                assetId: 267959,
                label: t('lyr_top_omm_label'),
                layer: 'top_omm',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CONSOLIDATED_ORDER,
                downloadUrl:
                  DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-UpperMarineMolasse.zip',
                geocatId: 'ea190c99-635c-4cf8-9e17-0bcfa938fbdf',
                previewColor: '#cad0c3',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267961,
                label: t('lyr_top_usm_label'),
                layer: 'top_usm',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CONSOLIDATED_ORDER,
                downloadUrl:
                  DOWNLOAD_ROOT_GEOMOL +
                  'GeoMol-Top-LowerFreshwaterMolasse.zip',
                geocatId: '2d7a0729-dd29-40fa-ad4f-b09f94b7fb00',
                previewColor: '#cdd0d0',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267966,
                label: t('lyr_top_umm_label'),
                layer: 'top_umm',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CONSOLIDATED_ORDER,
                downloadUrl:
                  DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-LowerMarineMolasse.zip',
                geocatId: 'fedb8d24-a000-4b78-9e6e-fb90305ad3ea',
                previewColor: '#d3cfc0',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267954,
                label: t('lyr_base_cenozoic_label'),
                layer: 'base_cenozoic',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CENOZOIC_BEDROCK_ORDER,
                downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Base-Cenozoic.zip',
                geocatId: '0e780e6c-18e2-4014-ad16-b35124706580',
                previewColor: '#d6d91a',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267958,
                label: t('lyr_top_cretaceous_label'),
                layer: 'top_cretaceous',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CONSOLIDATED_ORDER,
                downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Cretaceous.zip',
                geocatId: '09334747-14e7-40d6-881b-00e552b71f61',
                previewColor: '#b8d0c6',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267962,
                label: t('lyr_top_upper_malm_label'),
                layer: 'top_upper_malm',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CONSOLIDATED_ORDER,
                downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-UpperMalm.zip',
                geocatId: '2378cab1-4673-4837-b12e-a35aefab389a',
                previewColor: '#bdd1de',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267963,
                label: t('lyr_top_lower_malm_label'),
                layer: 'top_lower_malm',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CONSOLIDATED_ORDER,
                downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-LowerMalm.zip',
                geocatId: 'af51f4eb-1430-4e4e-a679-3c0eefb4a6b3',
                previewColor: '#c3d1da',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267957,
                label: t('lyr_top_dogger_label'),
                layer: 'top_dogger',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CONSOLIDATED_ORDER,
                downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Dogger.zip',
                geocatId: '0dea083d-23b0-4c5b-b82d-1cd7bda3d583',
                previewColor: '#c6c7c5',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267899,
                label: t('lyr_top_lias_label'),
                layer: 'top_lias',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CONSOLIDATED_ORDER,
                downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Lias.zip',
                geocatId: '793a40d6-ab83-4e1e-80d7-d7c49bf00f3c',
                previewColor: '#c6c5d9',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267960,
                label: t('lyr_top_keuper_label'),
                layer: 'top_keuper',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CONSOLIDATED_ORDER,
                downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Keuper.zip',
                geocatId: 'e2344c21-2139-4494-8679-36fe30d034f9',
                previewColor: '#d8cecc',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267953,
                label: t('lyr_top_muschelkalk_label'),
                layer: 'top_muschelkalk',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CONSOLIDATED_ORDER,
                downloadUrl:
                  DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Muschelkalk.zip',
                geocatId: 'dae3dd91-a04c-46c5-aa49-de6235c0478a',
                previewColor: '#d2c493',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267952,
                label: t('lyr_base_mesozoic_label'),
                layer: 'base_mesozoic',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CENOZOIC_BEDROCK_ORDER,
                downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Base-Mesozoic.zip',
                geocatId: 'ec67a58d-531e-4dae-98da-85c49525b4d2',
                previewColor: '#c4e0e0',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267965,
                label: t('lyr_base_permocarboniferous'),
                layer: 'base_permocarboniferous',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CONSOLIDATED_ORDER,
                downloadUrl:
                  DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Permocarboniferous.zip',
                geocatId: 'faa96a07-1877-4fa6-b2aa-536761d7c012',
                previewColor: '#bb9f8a',
              },
              {
                type: LayerType.tiles3d,
                assetId: 267964,
                label: t('lyr_base_permocarboniferous_supposed'),
                layer: 'base_permocarboniferous_supposed',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: CONSOLIDATED_ORDER,
                downloadUrl:
                  DOWNLOAD_ROOT_GEOMOL +
                  'GeoMol-Top-Permocarboniferous-inferred.zip',
                geocatId: '0f1acc23-bdfc-40bf-94b7-7be10f0f78ed',
                previewColor: '#c9b19e',
              },
            ],
          },
          {
            // Faults
            label: t('lyr_fault_zones_label'),
            children: [
              {
                type: LayerType.tiles3d,
                assetId: 267872,
                label: t('lyr_faults_geomol_label'),
                layer: 'faults_geomol',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: FAULTS_ORDER,
                downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Faults.zip',
                downloadDataType: 'indexed_download',
                downloadDataPath:
                  'https://download.swissgeol.ch/Faults/footprints_boxed.geojson',
                geocatId: 'f5661c1b-49e5-41e9-baf1-dee4811eb907',
                previewColor: '#c40001',
              },
            ],
          },
          {
            label: t('lyr_3d_local_models_label'),
            children: [
              {
                type: LayerType.tiles3d,
                assetId: 493224,
                label: t('lyr_3d_model_berne_label'),
                layer: '3d_model_berne',
                opacity: DEFAULT_LAYER_OPACITY,
                pickable: true,
                propsOrder: [
                  '3DBern-Unit',
                  '3DBern-Link',
                  '3DBern-Lithology',
                  '3DBern-TectonicUnit',
                  '3DBern-ChronoB-T',
                  '3DBern-OrigDesc',
                  '3DBern-Version',
                  '3DBern-Aothor',
                  '3DBern-Purpose',
                  '3DBern-Download',
                ],
                geocatId: '372c25ac-fb8a-44ee-8f81-6427939f6353',
              },
            ],
          },
        ],
      },
    ],
  };

const group_02: LayerTreeNode =
  // Topic - Borehole data
  {
    label: t('grp_1802_label'),
    children: [
      // Layer - Deep wells - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_geologie_bohrungen_tiefer_500_label'),
        layer: 'ch.swisstopo.geologie-bohrungen_tiefer_500',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'a61d9f7a-00cd-4448-a36d-b81423f1f566',
        legend: 'ch.swisstopo.geologie-bohrungen_tiefer_500',
      },
      {
        // Layer "Public boreholes"
        type: LayerType.tiles3d,
        assetId: 287568,
        label: t('lyr_boreholes_public_label'),
        layer: 'boreholes',
        opacity: DEFAULT_LAYER_OPACITY,
        pickable: true,
        visible: false,
        displayed: false, // private until they have been re-integrated
        restricted: [
          'ngm-dev-privileged',
          'ngm-int-privileged',
          'ngm-prod-privileged',
        ], // private until they have been re-integrated
        // Temporarily disable the boreholes download, see https://jira.camptocamp.com/browse/GSNGM-936
        // downloadDataType: 'csv',
        // downloadDataPath: 'https://download.swissgeol.ch/boreholes/bh_open_20210201_00.csv',
        propsOrder: [
          'bh_pub_XCOORD',
          'bh_pub_YCOORD',
          'bh_pub_ZCOORDB',
          'bh_pub_ORIGNAME',
          'bh_pub_NAMEPUB',
          'bh_pub_SHORTNAME',
          'bh_pub_BOHREDAT',
          'bh_pub_BOHRTYP',
          'bh_pub_GRUND',
          'bh_pub_RESTRICTIO',
          'bh_pub_TIEFEMD',
          'bh_pub_DEPTHFROM',
          'bh_pub_DEPTHTO',
          'bh_pub_LAYERDESC',
          'bh_pub_ORIGGEOL',
          'bh_pub_LITHOLOGY',
          'bh_pub_LITHOSTRAT',
          'bh_pub_CHRONOSTR',
          'bh_pub_TECTO',
          'bh_pub_USCS1',
          'bh_pub_USCS2',
          'bh_pub_USCS3',
        ],
        geocatId: '3996dfad-69dd-418f-a4e6-5f32b96c760a',
      },
      {
        // Layer "Private boreholes"
        type: LayerType.tiles3d,
        label: t('lyr_boreholes_private_label'),
        layer: 'boreholes_authenticated',
        opacity: DEFAULT_LAYER_OPACITY,
        pickable: true,
        visible: false,
        displayed: false,
        restricted: [
          'ngm-dev-privileged',
          'ngm-int-privileged',
          'ngm-prod-privileged',
        ], // the group required to see this layer
        aws_s3_bucket: 'ngm-protected-prod',
        aws_s3_key: 'tiles/bh_private_20210201_00/tileset.json',
      },
    ],
  };

const group_03: LayerTreeNode =
  // Topic - Geophysics
  {
    label: t('grp_1811_label'),
    children: [
      // Layer - Reflection seismic - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_geologie_reflexionsseismik_label'),
        layer: 'ch.swisstopo.geologie-reflexionsseismik',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '61866340-a491-444a-8f60-9a6e70df37d8',
        legend: 'ch.swisstopo.geologie-reflexionsseismik',
      },
      // Layer - Rock density - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_geologie_gesteinsdichte_label'),
        layer: 'ch.swisstopo.geologie-gesteinsdichte',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'c4a7ceb5-8bf5-457d-ab0a-57216dafce53',
        legend: 'ch.swisstopo.geologie-gesteinsdichte',
      },
      // Layer - Anthrop. seismic noise CH - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_geologie_bodenunruhe_label'),
        layer: 'ch.swisstopo.geologie-bodenunruhe',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '4dba9c57-2e2b-4b69-844b-bd2001fa53a8',
        legend: 'ch.swisstopo.geologie-bodenunruhe',
      },
      // Layer - Terrestrial Radiation - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_geologie_dosisleistung_terrestrisch_label'),
        layer: 'ch.swisstopo.geologie-dosisleistung-terrestrisch',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'eccbc751-9928-4221-89e1-1184cbb3aff5',
        legend: 'ch.swisstopo.geologie-dosisleistung-terrestrisch',
      },
      // Topic - Earth's gravity field
      {
        label: t('grp_1812_label'),
        children: [
          // Layer - Gravimetric base network - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_landesschwerenetz_label'),
            layer: 'ch.swisstopo.landesschwerenetz',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '95879cd4-e93d-4d4d-af57-4ec6731b9c97',
            legend: 'ch.swisstopo.landesschwerenetz',
          },
          // Layer - Isostatic anomalies 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_geodaesie_isostatische_anomalien_label',
            ),
            layer: 'ch.swisstopo.geologie-geodaesie-isostatische_anomalien',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '7234896a-842c-4524-8710-5d900953cb1d',
            legend: 'ch.swisstopo.geologie-geodaesie-isostatische_anomalien',
          },
          // Layer - Bouguer anomalies 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_geodaesie_bouguer_anomalien_label',
            ),
            layer: 'ch.swisstopo.geologie-geodaesie-bouguer_anomalien',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '618c9697-129f-47c7-830a-7a256b4c2499',
            legend: 'ch.swisstopo.geologie-geodaesie-bouguer_anomalien',
          },
          // Layer - Gravimetric Atlas 100 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_gravimetrischer_atlas_label'),
            layer: 'ch.swisstopo.geologie-gravimetrischer_atlas',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '732cb247-8307-4cc7-8c31-b1c505a94633',
            legend: 'ch.swisstopo.geologie-gravimetrischer_atlas',
          },
          // Layer - Gravimetric measuring points 100 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_gravimetrischer_atlas_messpunkte_label',
            ),
            layer: 'ch.swisstopo.geologie-gravimetrischer_atlas.messpunkte',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '297a1958-3636-45af-a17c-e90120605132',
            legend: 'ch.swisstopo.geologie-gravimetrischer_atlas.messpunkte',
          },
          // Layer - Geoid in CH1903 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geoidmodell_ch1903_label'),
            layer: 'ch.swisstopo.geoidmodell-ch1903',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '2b20aece-5cb1-41f1-a618-7c6e1ff6a81b',
            legend: 'ch.swisstopo.geoidmodell-ch1903',
          },
        ],
      },
      // Topic - Earth's magnetic field
      {
        label: t('grp_1818_label'),
        children: [
          // Layer - Aeromagnetics 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_geophysik_aeromagnetische_karte_schweiz_label',
            ),
            layer:
              'ch.swisstopo.geologie-geophysik-aeromagnetische_karte_schweiz',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '4cc706a2-0005-4cc6-8326-7b944a1d5b05',
            legend:
              'ch.swisstopo.geologie-geophysik-aeromagnetische_karte_schweiz',
          },
          // Layer - Aeromagnetics Plateau/Jura 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_geophysik_aeromagnetische_karte_jura_label',
            ),
            layer: 'ch.swisstopo.geologie-geophysik-aeromagnetische_karte_jura',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'f952b9be-9a11-478c-a21c-9d5e8631c7c2',
            legend:
              'ch.swisstopo.geologie-geophysik-aeromagnetische_karte_jura',
          },
          // Layer - Aeromagnetic Aargau 1100 m 100 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_nagra_aeromagnetische_karte_1100_label'),
            layer: 'ch.nagra.aeromagnetische-karte_1100',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '2ffdbb13-27dc-4380-8349-8debfeca4fd9',
            legend: 'ch.nagra.aeromagnetische-karte_1100',
          },
          // Layer - Aeromagnetic Aargau 1500 m 100 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_nagra_aeromagnetische_karte_1500_label'),
            layer: 'ch.nagra.aeromagnetische-karte_1500',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'b814401b-9eb2-4e6c-b4a9-f24df7b8bba6',
            legend: 'ch.nagra.aeromagnetische-karte_1500',
          },
          // Layer - Declination 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geophysik_deklination_label'),
            layer: 'ch.swisstopo.geologie-geophysik-deklination',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '8f38b25f-f984-450a-ae48-02290e82136c',
            legend: 'ch.swisstopo.geologie-geophysik-deklination',
          },
          // Layer - Inclination 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geophysik_inklination_label'),
            layer: 'ch.swisstopo.geologie-geophysik-inklination',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '639c0536-bfea-44d3-b088-ed7b6b43cde9',
            legend: 'ch.swisstopo.geologie-geophysik-inklination',
          },
          // Layer - Magnetic field strength 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_geophysik_totalintensitaet_label',
            ),
            layer: 'ch.swisstopo.geologie-geophysik-totalintensitaet',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '132d9ff6-92de-4c02-87a7-72df26bcb33e',
            legend: 'ch.swisstopo.geologie-geophysik-totalintensitaet',
          },
        ],
      },
    ],
  };

const group_04: LayerTreeNode =
  // Topic - Geoenergy
  {
    label: t('grp_15070_label'),
    children: [
      // Layer - Deep geothermal projects - WMS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_geologie_tiefengeothermie_projekte_label'),
        layer: 'ch.swisstopo.geologie-tiefengeothermie_projekte',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '2df11e59-d85a-40cf-98cf-4b941577e23c',
        legend: 'ch.swisstopo.geologie-tiefengeothermie_projekte',
      },
      // Layer - Deep wells - WMTS
      /*  --> Duplikate: Temporarily switched off
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_geologie_bohrungen_tiefer_500_label'),
        layer: 'ch.swisstopo.geologie-bohrungen_tiefer_500',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'a61d9f7a-00cd-4448-a36d-b81423f1f566',
        legend: 'ch.swisstopo.geologie-bohrungen_tiefer_500'
      }
      ,
      */
      // Layer - Reflection seismic - WMTS
      /* --> Duplikate: Temporarily switched off
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_geologie_reflexionsseismik_label'),
        layer: 'ch.swisstopo.geologie-reflexionsseismik',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '61866340-a491-444a-8f60-9a6e70df37d8',
        legend: 'ch.swisstopo.geologie-reflexionsseismik'
      }
      ,
      */
      // Layer - Thermal waters - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_geologie_thermale_waesser_label'),
        layer: 'ch.swisstopo.geologie-thermale_waesser',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '04fb057a-4c46-4d6d-8a64-8003df749762',
        legend: 'ch.swisstopo.geologie-thermale_waesser',
      },
      // Layer - Groundwater heat utilisation potential - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_bfe_grundwasserwaermenutzungspotential_label'),
        layer: 'ch.bfe.grundwasserwaermenutzungspotential',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'd64de95f-1b3d-4df3-b395-68b0404ac8ca',
        legend: 'ch.bfe.grundwasserwaermenutzungspotential',
      },
      // Layer - Geothermal potential studies - WMS
      {
        type: LayerType.swisstopoWMTS,
        label: t(
          'lyr_ch_swisstopo_geologie_geothermische_potenzialstudien_regional_label',
        ),
        layer: 'ch.swisstopo.geologie-geothermische_potenzialstudien_regional',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '1c050393-fe3a-41b1-a31e-3173f51181d8',
        legend: 'ch.swisstopo.geologie-geothermische_potenzialstudien_regional',
      },
      // Topic - Temperature models
      {
        label: t('grp_15180_label'),
        children: [
          // Layer - Heat flux 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geophysik_geothermie_label'),
            layer: 'ch.swisstopo.geologie-geophysik-geothermie',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '2d8174b2-8c4a-44ea-b470-cb3f216b90d1',
            legend: 'ch.swisstopo.geologie-geophysik-geothermie',
          },
          // Layer - Temperature model - data - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_geomol_temperaturmodell_eingangsdaten_label',
            ),
            layer:
              'ch.swisstopo.geologie-geomol-temperaturmodell_eingangsdaten',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '63ed59b1-d9fb-4c6e-a629-550c8f6b9bf2',
            legend:
              'ch.swisstopo.geologie-geomol-temperaturmodell_eingangsdaten',
          },
          /* 2D - data
          // Layer - Elevation 60 °C isotherm - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomol_isotherme_60_label'),
            layer: 'ch.swisstopo.geologie-geomol-isotherme_60',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '6edca35d-0f08-43b9-9faf-4c7b207888a1',
            legend: 'ch.swisstopo.geologie-geomol-isotherme_60'
          }
          ,
          // Layer - Elevation 100 °C isotherm - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomol_isotherme_100_label'),
            layer: 'ch.swisstopo.geologie-geomol-isotherme_100',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '8681fb45-6220-41ef-825a-86210d8a72fc',
            legend: 'ch.swisstopo.geologie-geomol-isotherme_100'
          }
          ,
          // Layer - Elevation 150 °C isotherm - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomol_isotherme_150_label'),
            layer: 'ch.swisstopo.geologie-geomol-isotherme_150',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '31dc428e-a62b-4f6b-a263-e5eca9d9a074',
            legend: 'ch.swisstopo.geologie-geomol-isotherme_150'
          }
          ,
          // Layer - Temperatures Top OMM - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomol_temperatur_top_omm_label'),
            layer: 'ch.swisstopo.geologie-geomol-temperatur_top_omm',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '4f9e3f59-891e-434b-bba5-40db1b9495e0',
            legend: 'ch.swisstopo.geologie-geomol-temperatur_top_omm'
          }
          ,
          // Layer - Temperatures Top Upper Malm - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomol_temperatur_top_omalm_label'),
            layer: 'ch.swisstopo.geologie-geomol-temperatur_top_omalm',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '613cdc6f-0237-416d-af16-ae5d2f1934ff',
            legend: 'ch.swisstopo.geologie-geomol-temperatur_top_omalm'
          }
          ,
          // Layer - Temperatures Top Muschelkalk - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomol_temperatur_top_muschelkalk_label'),
            layer: 'ch.swisstopo.geologie-geomol-temperatur_top_muschelkalk',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'e0be0de5-4ed0-488a-a952-5eb385fd5595',
            legend: 'ch.swisstopo.geologie-geomol-temperatur_top_muschelkalk'
          }
          ,
          // Layer - Temperatures 500 m depth - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomol_temperaturverteilung_500_label'),
            layer: 'ch.swisstopo.geologie-geomol-temperaturverteilung_500',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '08e66941-4ebb-4017-8018-b39caa8fd107',
            legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_500'
          }
          ,
          // Layer - Temperatures 1000 m depth - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomol_temperaturverteilung_1000_label'),
            layer: 'ch.swisstopo.geologie-geomol-temperaturverteilung_1000',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '5e32ea72-a356-4250-b40a-a441165fd936',
            legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_1000'
          }
          ,
          // Layer - Temperatures 1500 m depth - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomol_temperaturverteilung_1500_label'),
            layer: 'ch.swisstopo.geologie-geomol-temperaturverteilung_1500',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '162989d7-5c1c-48fb-8d16-2ccf5be339b9',
            legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_1500'
          }
          ,
          // Layer - Temperatures 2000 m depth - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomol_temperaturverteilung_2000_label'),
            layer: 'ch.swisstopo.geologie-geomol-temperaturverteilung_2000',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'ac604460-7a7a-44c5-bc5a-41062fbd21ff',
            legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_2000'
          }
          ,
          // Layer - Temperatures 3000 m depth - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomol_temperaturverteilung_3000_label'),
            layer: 'ch.swisstopo.geologie-geomol-temperaturverteilung_3000',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '47f79661-212e-4297-b048-2606db7affa8',
            legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_3000'
          }
          ,
          // Layer - Temperatures 4000 m depth - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geomol_temperaturverteilung_4000_label'),
            layer: 'ch.swisstopo.geologie-geomol-temperaturverteilung_4000',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '739e9095-77f6-462d-9a1e-438898cf0c9c',
            legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_4000'
          },
          */
          {
            // Layer "Temperature model GeoMol"
            type: LayerType.voxels3dtiles,
            url: 'https://download.swissgeol.ch/testvoxel/20240617/Voxel-Temperaturmodell-GeoMol15/tileset.json',
            voxelDataName: 'Temp_C',
            voxelColors: temperaturVoxelColors,
            label: t('lyr_temperature_model_label'),
            layer: 'temperature_model',
            opacityDisabled: true,
            pickable: true,
            geocatId: '63ed59b1-d9fb-4c6e-a629-550c8f6b9bf2',
          },
          {
            // Layer "Isotherm 60"
            type: LayerType.tiles3d,
            assetId: 251755,
            label: t('lyr_temperature_isotherm_60c_label'),
            layer: 'temperature_isotherm_60c',
            propsOrder: TEMPERATURE_HORIZON_ORDER,
            pickable: true,
            geocatId: '6edca35d-0f08-43b9-9faf-4c7b207888a1',
            legend: 'ch.swisstopo.geologie-geomol-isotherme_60',
          },
          {
            // Layer "Isotherm 100"
            type: LayerType.tiles3d,
            assetId: 251787,
            label: t('lyr_temperature_isotherm_100c_label'),
            layer: 'temperature_isotherm_100c',
            propsOrder: TEMPERATURE_HORIZON_ORDER,
            pickable: true,
            geocatId: '8681fb45-6220-41ef-825a-86210d8a72fc',
            legend: 'ch.swisstopo.geologie-geomol-isotherme_100',
          },
          {
            // Layer "Isotherm 150"
            type: LayerType.tiles3d,
            assetId: 251783,
            label: t('lyr_temperature_isotherm_150c_label'),
            layer: 'temperature_isotherm_150c',
            propsOrder: TEMPERATURE_HORIZON_ORDER,
            pickable: true,
            geocatId: '31dc428e-a62b-4f6b-a263-e5eca9d9a074',
            legend: 'ch.swisstopo.geologie-geomol-isotherme_150',
          },
          {
            // Layer "Temperature TOMM"
            type: LayerType.tiles3d,
            assetId: 251747,
            label: t('lyr_temperature_horizon_tomm_label'),
            layer: 'temperature_horizon_tomm',
            propsOrder: TEMPERATURE_HORIZON_ORDER,
            pickable: true,
            geocatId: '4f9e3f59-891e-434b-bba5-40db1b9495e0',
            legend: 'ch.swisstopo.geologie-geomol-temperatur_top_omm',
          },
          {
            // Layer "Temperature TUMA"
            type: LayerType.tiles3d,
            assetId: 251782,
            label: t('lyr_temperature_horizon_tuma_label'),
            layer: 'temperature_horizon_tuma',
            propsOrder: TEMPERATURE_HORIZON_ORDER,
            pickable: true,
            geocatId: '613cdc6f-0237-416d-af16-ae5d2f1934ff',
            legend: 'ch.swisstopo.geologie-geomol-temperatur_top_omalm',
          },
          {
            // Layer "Temperature TUMS"
            type: LayerType.tiles3d,
            assetId: 251781,
            label: t('lyr_temperature_horizon_tmus_label'),
            layer: 'temperature_horizon_tmus',
            propsOrder: TEMPERATURE_HORIZON_ORDER,
            pickable: true,
            geocatId: 'e0be0de5-4ed0-488a-a952-5eb385fd5595',
            legend: 'ch.swisstopo.geologie-geomol-temperatur_top_muschelkalk',
          },
          {
            // Layer "Temperature 500m"
            type: LayerType.tiles3d,
            assetId: 251756,
            label: t('lyr_temperature_500_bgl_label'),
            layer: 'temperature_500_bgl',
            propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
            pickable: true,
            geocatId: '08e66941-4ebb-4017-8018-b39caa8fd107',
            legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_500',
          },
          {
            // Layer "Temperature 1000m"
            type: LayerType.tiles3d,
            assetId: 251788,
            label: t('lyr_temperature_1000_bgl_label'),
            layer: 'temperature_1000_bgl',
            propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
            pickable: true,
            geocatId: '5e32ea72-a356-4250-b40a-a441165fd936',
            legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_1000',
          },
          {
            // Layer "Temperature 1500m"
            type: LayerType.tiles3d,
            assetId: 251790,
            label: t('lyr_temperature_1500_bgl_label'),
            layer: 'temperature_1500_bgl',
            propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
            pickable: true,
            geocatId: '162989d7-5c1c-48fb-8d16-2ccf5be339b9',
            legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_1500',
          },
          {
            // Layer "Temperature 2000m"
            type: LayerType.tiles3d,
            assetId: 251786,
            label: t('lyr_temperature_2000_bgl_label'),
            layer: 'temperature_2000_bgl',
            propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
            pickable: true,
            geocatId: 'ac604460-7a7a-44c5-bc5a-41062fbd21ff',
            legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_2000',
          },
          {
            // Layer "Temperature 3000m"
            type: LayerType.tiles3d,
            assetId: 251785,
            label: t('lyr_temperature_3000_bgl_label'),
            layer: 'temperature_3000_bgl',
            propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
            pickable: true,
            geocatId: '47f79661-212e-4297-b048-2606db7affa8',
            legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_3000',
          },
          {
            // Layer "Temperature 4000m"
            type: LayerType.tiles3d,
            assetId: 251789,
            label: t('lyr_temperature_4000_bgl_label'),
            layer: 'temperature_4000_bgl',
            propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
            pickable: true,
            geocatId: '739e9095-77f6-462d-9a1e-438898cf0c9c',
            legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_4000',
          },
        ],
      },
    ],
  };

const group_05: LayerTreeNode =
  // Topic - Mineral resources
  {
    label: t('grp_15034_label'),
    children: [
      // Topic - Construction raw materials
      {
        label: t('grp_15181_label'),
        children: [
          // Layer - Cement raw materials - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_rohstoffe_zement_abbau_verarbeitung_label',
            ),
            layer: 'ch.swisstopo.geologie-rohstoffe-zement_abbau_verarbeitung',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '9128ae2a-acdf-42cf-bb67-00755f0857fb',
            legend: 'ch.swisstopo.geologie-rohstoffe-zement_abbau_verarbeitung',
          },
          // Layer - Hard rock: Production sites - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_hartsteinabbau_label'),
            layer: 'ch.swisstopo.geologie-hartsteinabbau',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'fa939fea-8a3f-4911-ad83-33be66daa45c',
            legend: 'ch.swisstopo.geologie-hartsteinabbau',
          },
          // Layer - Hard rock: Occurrences - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_hartsteinvorkommen_label'),
            layer: 'ch.swisstopo.geologie-hartsteinvorkommen',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '258c7ccf-5e7f-4759-9c09-519d41ba4d02',
            legend: 'ch.swisstopo.geologie-hartsteinvorkommen',
          },
          // Layer - Crushed-rock aggregates - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_rohstoffe_gebrochene_gesteine_abbau_label',
            ),
            layer: 'ch.swisstopo.geologie-rohstoffe-gebrochene_gesteine_abbau',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'bb682732-ca6d-43f4-8c95-760b76004b22',
            legend: 'ch.swisstopo.geologie-rohstoffe-gebrochene_gesteine_abbau',
          },
          // Layer - Brickworks raw materials - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_rohstoffe_ziegel_abbau_label'),
            layer: 'ch.swisstopo.geologie-rohstoffe-ziegel_abbau',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '3d0120f4-34b2-40cf-b61c-127bd9a27522',
            legend: 'ch.swisstopo.geologie-rohstoffe-ziegel_abbau',
          },
          // Layer - Dimension stone - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_rohstoffe_naturwerksteine_abbau_label',
            ),
            layer: 'ch.swisstopo.geologie-rohstoffe-naturwerksteine_abbau',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '0b22a108-693c-4b6e-9e43-7614eb0e0bc3',
            legend: 'ch.swisstopo.geologie-rohstoffe-naturwerksteine_abbau',
          },
          // Layer - Natural stones on buildings - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_geotechnik_steine_historische_bauwerke_label',
            ),
            layer:
              'ch.swisstopo.geologie-geotechnik-steine_historische_bauwerke',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'efe1b3cf-dac4-4660-a5bd-a9269a3d97db',
            legend:
              'ch.swisstopo.geologie-geotechnik-steine_historische_bauwerke',
          },
        ],
      },
      // Topic - Metallic raw materials
      {
        label: t('grp_15038_label'),
        children: [
          // Layer - Metallic raw materials - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_rohstoffe_vererzungen_label'),
            layer: 'ch.swisstopo.geologie-rohstoffe-vererzungen',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '46dd5d50-6f7e-4175-ab64-051b16750e38',
            legend: 'ch.swisstopo.geologie-rohstoffe-vererzungen',
          },
        ],
      },
      // Topic - Industrial minerals
      {
        label: t('grp_15182_label'),
        children: [
          // Layer - Gypsum - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_rohstoffe_gips_abbau_verarbeitung_label',
            ),
            layer: 'ch.swisstopo.geologie-rohstoffe-gips_abbau_verarbeitung',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '33f974a7-8852-449d-ba68-646b10710f60',
            legend: 'ch.swisstopo.geologie-rohstoffe-gips_abbau_verarbeitung',
          },
          // Layer - Salt - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_rohstoffe_salz_abbau_verarbeitung_label',
            ),
            layer: 'ch.swisstopo.geologie-rohstoffe-salz_abbau_verarbeitung',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'e5bed380-6a35-46c9-97c9-0cbf5875f292',
            legend: 'ch.swisstopo.geologie-rohstoffe-salz_abbau_verarbeitung',
          },
          // Layer - Other industrial minerals - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_rohstoffe_industrieminerale_label',
            ),
            layer: 'ch.swisstopo.geologie-rohstoffe-industrieminerale',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'ec3471db-6e86-4148-abbf-d702196381bd',
            legend: 'ch.swisstopo.geologie-rohstoffe-industrieminerale',
          },
        ],
      },
      // Topic - Energy raw materials
      {
        label: t('grp_15183_label'),
        children: [
          // Layer - Energy raw materials - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_swisstopo_geologie_rohstoffe_kohlen_bitumen_erdgas_label',
            ),
            layer: 'ch.swisstopo.geologie-rohstoffe-kohlen_bitumen_erdgas',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'ee51374d-1472-44bd-a5a7-c65c4e46f3b4',
            legend: 'ch.swisstopo.geologie-rohstoffe-kohlen_bitumen_erdgas',
          },
        ],
      },
    ],
  };

const group_06: LayerTreeNode =
  // Topic - Groundwater
  {
    label: t('grp_15179_label'),
    children: [
      // Layer - Thermal waters - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_geologie_thermale_waesser_label'),
        layer: 'ch.swisstopo.geologie-thermale_waesser',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '04fb057a-4c46-4d6d-8a64-8003df749762',
        legend: 'ch.swisstopo.geologie-thermale_waesser',
      },
      // Layer - Hydrogeological sketch - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_bafu_hydrogeologie_uebersichtskarte_label'),
        layer: 'ch.bafu.hydrogeologie-uebersichtskarte',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'e238580b-a03d-45c2-9ea6-f6634ff9c64c',
        legend: 'ch.bafu.hydrogeologie-uebersichtskarte',
      },
      // Layer - Groundwater Resources 500 - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t(
          'lyr_ch_swisstopo_geologie_hydrogeologische_karte_grundwasservorkommen_label',
        ),
        layer:
          'ch.swisstopo.geologie-hydrogeologische_karte-grundwasservorkommen',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'f198f6f6-8efa-4235-a55f-99767ea0206c',
        legend:
          'ch.swisstopo.geologie-hydrogeologische_karte-grundwasservorkommen',
      },
      // Layer - Groundwater Vulnerability 500 - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t(
          'lyr_ch_swisstopo_geologie_hydrogeologische_karte_grundwasservulnerabilitaet_label',
        ),
        layer:
          'ch.swisstopo.geologie-hydrogeologische_karte-grundwasservulnerabilitaet',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'b8efde6b-7323-4496-aa70-b976ec55cec9',
        legend:
          'ch.swisstopo.geologie-hydrogeologische_karte-grundwasservulnerabilitaet',
      },
      // Layer - Hydrogeological map 100 - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_bafu_hydrogeologische_karte_100_label'),
        layer: 'ch.bafu.hydrogeologische-karte_100',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'b01523a1-9f61-43a2-95cb-be843cc1b18a',
        legend: 'ch.bafu.hydrogeologische-karte_100',
      },
      // Topic - Karst groundwater
      {
        label: t('grp_15184_label'),
        children: [
          // Layer - Karst water resources - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_karst_ausdehnung_grundwasservorkommen_label'),
            layer: 'ch.bafu.karst-ausdehnung_grundwasservorkommen',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '4ea295bb-a098-492b-84f8-e7687737fb35',
            legend: 'ch.bafu.karst-ausdehnung_grundwasservorkommen',
          },
          // Layer - Karst springs and swallow holes - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_karst_quellen_schwinden_label'),
            layer: 'ch.bafu.karst-quellen_schwinden',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '1786c0cc-8aac-44b1-880c-aa627de09c1e',
            legend: 'ch.bafu.karst-quellen_schwinden',
          },
          // Layer - Underground flow paths - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_karst_unterirdische_fliesswege_label'),
            layer: 'ch.bafu.karst-unterirdische_fliesswege',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '7db32f1d-691d-4d2d-a842-ee188210acf6',
            legend: 'ch.bafu.karst-unterirdische_fliesswege',
          },
          // Layer - Karst catchments - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_karst_einzugsgebiete_label'),
            layer: 'ch.bafu.karst-einzugsgebiete',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '01811bd5-7f55-4c89-92f2-78fcd379affa',
            legend: 'ch.bafu.karst-einzugsgebiete',
          },
          // Layer - Karst catchment units - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_karst_einzugsgebietseinheiten_label'),
            layer: 'ch.bafu.karst-einzugsgebietseinheiten',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'fa918831-97d1-4486-a348-c891f4e900ad',
            legend: 'ch.bafu.karst-einzugsgebietseinheiten',
          },
        ],
      },
      // Layer - Groundwater bodies - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_bafu_grundwasserkoerper_label'),
        layer: 'ch.bafu.grundwasserkoerper',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '2bd1ab86-83ec-4c3e-b937-ab81b4968bc6',
        legend: 'ch.bafu.grundwasserkoerper',
      },
      // Topic - Groundwater quantity
      {
        label: t('grp_15185_label'),
        children: [
          // Layer - NAQUA-QUANT Monitoring sites - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_hydroweb_messstationen_grundwasser_label'),
            layer: 'ch.bafu.hydroweb-messstationen_grundwasser',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '6146dc21-18b6-4d94-8865-8c2b99256e1b',
            legend: 'ch.bafu.hydroweb-messstationen_grundwasser',
          },
          // Layer - Groundwater level/spring discharge - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t(
              'lyr_ch_bafu_hydroweb_messstationen_grundwasserzustand_label',
            ),
            layer: 'ch.bafu.hydroweb-messstationen_grundwasserzustand',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'f87d692e-8d65-4188-94ba-61b4c61d621c',
            legend: 'ch.bafu.hydroweb-messstationen_grundwasserzustand',
          },
        ],
      },
      // Layer - Tracer tests - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_bafu_hydrogeologie_markierversuche_label'),
        layer: 'ch.bafu.hydrogeologie-markierversuche',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'fedac2fe-5f2b-4b4f-a21d-3c9fc216c496',
        legend: 'ch.bafu.hydrogeologie-markierversuche',
      },
      // Topic - Groundwater quality
      {
        label: t('grp_15186_label'),
        children: [
          // Layer - Groundwater: Nitrate - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_naqua_grundwasser_nitrat_label'),
            layer: 'ch.bafu.naqua-grundwasser_nitrat',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'ea282e54-364b-4023-87c1-cdccbac295b1',
            legend: 'ch.bafu.naqua-grundwasser_nitrat',
          },
          // Layer - Groundwater: VOC - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_naqua_grundwasser_voc_label'),
            layer: 'ch.bafu.naqua-grundwasser_voc',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'c5f01eb1-d755-4450-bc4f-3871589de62f',
            legend: 'ch.bafu.naqua-grundwasser_voc',
          },
        ],
      },
    ],
  };

const group_07: LayerTreeNode =
  // Topic - Natural hazards
  {
    label: t('grp_1858_label'),
    children: [
      // Topic - Mass movements
      {
        label: t('grp_1859_label'),
        children: [
          // Layer - Snow avalanches (SilvaProtect-CH) - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_silvaprotect_lawinen_label'),
            layer: 'ch.bafu.silvaprotect-lawinen',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '8e350471-6259-4142-ad00-d99ddcefd2a4',
            legend: 'ch.bafu.silvaprotect-lawinen',
          },
          // Layer - Landslide (SilvaProtect-CH) - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_silvaprotect_hangmuren_label'),
            layer: 'ch.bafu.silvaprotect-hangmuren',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'e1f63878-1ddd-4a51-9d3b-f0f077990357',
            legend: 'ch.bafu.silvaprotect-hangmuren',
          },
          // Layer - Debris flow (SilvaProtect-CH) - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_silvaprotect_murgang_label'),
            layer: 'ch.bafu.silvaprotect-murgang',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '36f3b788-9d79-40f4-a69e-8c742729a745',
            legend: 'ch.bafu.silvaprotect-murgang',
          },
          // Layer - Rockfall (SilvaProtect-CH) - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_silvaprotect_sturz_label'),
            layer: 'ch.bafu.silvaprotect-sturz',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '238d97d6-8853-4e26-af30-dc5cbadd58dc',
            legend: 'ch.bafu.silvaprotect-sturz',
          },
          // Layer - Overbank sedimentation (SilvaProtect-CH) - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_silvaprotect_uebersarung_label'),
            layer: 'ch.bafu.silvaprotect-uebersarung',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '7c608bf9-bddf-490b-8a46-3415f3c74cf3',
            legend: 'ch.bafu.silvaprotect-uebersarung',
          },
        ],
      },
      // Topic - Earthquakes
      {
        label: t('grp_1865_label'),
        children: [
          // Layer - Historical earthquakes - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_gefahren_historische_erdbeben_label'),
            layer: 'ch.bafu.gefahren-historische_erdbeben',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '3d1d7649-8c27-435c-ae74-7c0f2e3fbcf1',
            legend: 'ch.bafu.gefahren-historische_erdbeben',
          },
          {
            // Layer "Erdbeben - aktuell"
            type: LayerType.earthquakes,
            label: t('lyr_earthquakes_label'),
            layer: 'earthquakes',
            visible: false,
            displayed: false,
            pickable: true,
            opacity: DEFAULT_LAYER_OPACITY,
            propsOrder: EARTHQUAKES_PROP_ORDER,
            downloadUrl:
              'https://download.swissgeol.ch/earthquakes/earthquakes_last_90d.txt',
            detailsUrl:
              'http://www.seismo.ethz.ch/en/earthquakes/switzerland/last-90-days',
            geocatId: 'f44ee7fc-efd0-47ad-8a8c-db74dcc20610',
          },
          {
            // Layer "Erdbeben - > mag 3"
            type: LayerType.earthquakes,
            label: t('lyr_historical_earthquakes_label'),
            layer: 'historical_earthquakes',
            visible: false,
            displayed: false,
            pickable: true,
            opacity: DEFAULT_LAYER_OPACITY,
            propsOrder: EARTHQUAKES_PROP_ORDER,
            downloadUrl:
              'https://download.swissgeol.ch/earthquakes/earthquakes_magnitude_gt_3.txt',
            detailsUrl: 'http://www.seismo.ethz.ch',
            geocatId: 'fab0e70e-6e33-4ba9-8c42-2b8ac1578384',
          },
          // Layer - Seismic zones SIA 261 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_gefahren_gefaehrdungszonen_label'),
            layer: 'ch.bafu.gefahren-gefaehrdungszonen',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '239a4b60-9478-4120-87d9-5671c4516269',
            legend: 'ch.bafu.gefahren-gefaehrdungszonen',
          },
          // Layer - Seismic subsoil classes - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_gefahren_baugrundklassen_label'),
            layer: 'ch.bafu.gefahren-baugrundklassen',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '812485e6-821c-412d-8504-459c6b314d1c',
            legend: 'ch.bafu.gefahren-baugrundklassen',
          },
          // Layer - Spectral micro-zoning - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_gefahren_spektral_label'),
            layer: 'ch.bafu.gefahren-spektral',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'a869c0d0-ff03-4cbf-93e8-c568f01bf9bc',
            legend: 'ch.bafu.gefahren-spektral',
          },
        ],
      },
      // Topic - Permafrost
      {
        label: t('grp_15176_label'),
        children: [
          // Layer - Potential permafrost distribution - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_permafrost_label'),
            layer: 'ch.bafu.permafrost',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '71d087ef-6531-4131-98ea-88ff655d8a63',
            legend: 'ch.bafu.permafrost',
          },
        ],
      },
      // Topic - Floods
      {
        label: t('grp_1870_label'),
        children: [
          // Layer - Overland flow map - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_gefaehrdungskarte_oberflaechenabfluss_label'),
            layer: 'ch.bafu.gefaehrdungskarte-oberflaechenabfluss',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '6b59f9ee-9e5f-4b12-86cf-f8afb539ae5d',
            legend: 'ch.bafu.gefaehrdungskarte-oberflaechenabfluss',
          },
          // Layer - Areas of flooding Aquaprotect 50 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_aquaprotect_050_label'),
            layer: 'ch.bafu.aquaprotect_050',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'e7f4931d-2010-4ab2-b4ef-edbc47074ca9',
            legend: 'ch.bafu.aquaprotect_050',
          },
          // Layer - Areas of flooding Aquaprotect 100 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_aquaprotect_100_label'),
            layer: 'ch.bafu.aquaprotect_100',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'a71453bf-e515-4f70-98cc-c939510dd4b1',
            legend: 'ch.bafu.aquaprotect_100',
          },
          // Layer - Areas of flooding Aquaprotect 250 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_aquaprotect_250_label'),
            layer: 'ch.bafu.aquaprotect_250',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'a889473d-cbe4-454c-838b-aac6b174e46e',
            legend: 'ch.bafu.aquaprotect_250',
          },
          // Layer - Areas of flooding Aquaprotect 500 - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_aquaprotect_500_label'),
            layer: 'ch.bafu.aquaprotect_500',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '7609e210-80c7-4acc-b7b4-b569f0e5679e',
            legend: 'ch.bafu.aquaprotect_500',
          },
          // Layer - Flood hazard levels - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_hydroweb_messstationen_gefahren_label'),
            layer: 'ch.bafu.hydroweb-messstationen_gefahren',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '7c64e2fa-1afe-41f4-9f91-ed251079965c',
            legend: 'ch.bafu.hydroweb-messstationen_gefahren',
          },
          // Layer - Stations hydrological forecasts - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_hydroweb_messstationen_vorhersage_label'),
            layer: 'ch.bafu.hydroweb-messstationen_vorhersage',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '6655ccdb-fb9b-4049-8bf5-4d5a0b3bfe4f',
            legend: 'ch.bafu.hydroweb-messstationen_vorhersage',
          },
          // Layer - Flood alert map - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_bafu_hydroweb_warnkarte_national_label'),
            layer: 'ch.bafu.hydroweb-warnkarte_national',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'e1d0c17a-0dbd-4455-bc83-1606e1e04298',
            legend: 'ch.bafu.hydroweb-warnkarte_national',
          },
        ],
      },
    ],
  };

const group_08: LayerTreeNode =
  // Topic - Geotourism, Geology for all
  {
    label: t('grp_1884_label'),
    children: [
      // Topic - Experience Geology
      {
        label: t('grp_1885_label'),
        children: [
          // Layer - Upcoming GeoEvents - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geoevents_demnaechst_label'),
            layer: 'ch.swisstopo.geologie-geoevents_demnaechst',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '64508bcc-8a66-4d90-bb9a-bc83c931b0c6',
            legend: 'ch.swisstopo.geologie-geoevents_demnaechst',
          },
          // Layer - GeoEvents on request - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geoevents_anfrage_label'),
            layer: 'ch.swisstopo.geologie-geoevents_anfrage',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '6f4fc3a9-8dc0-4cc2-b176-f804e5157dab',
            legend: 'ch.swisstopo.geologie-geoevents_anfrage',
          },
          // Layer - Geosites - WMS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geosites_label'),
            layer: 'ch.swisstopo.geologie-geosites',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'af46b0e7-25b4-49ca-a357-c0ab6e794dd6',
            legend: 'ch.swisstopo.geologie-geosites',
          },
          // Layer - Geo-trails - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geowege_label'),
            layer: 'ch.swisstopo.geologie-geowege',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: '3356602e-23d5-4e42-9d75-55fe9cc2daba',
            legend: 'ch.swisstopo.geologie-geowege',
          },
        ],
      },
      // Topic - Geotopes
      {
        label: t('grp_15079_label'),
        children: [
          // Layer - Geotopes in Switzerland - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geotope_label'),
            layer: 'ch.swisstopo.geologie-geotope',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'e7dd54e9-fc98-4e5c-b46a-694d1ba6c84e',
            legend: 'ch.swisstopo.geologie-geotope',
          },
          // Layer - Status of cantonal geotopes - WMTS
          {
            type: LayerType.swisstopoWMTS,
            label: t('lyr_ch_swisstopo_geologie_geotope_kantone_stand_label'),
            layer: 'ch.swisstopo.geologie-geotope_kantone_stand',
            maximumLevel: 18,
            visible: false,
            displayed: false,
            opacity: 0.7,
            queryType: 'geoadmin',
            geocatId: 'c4d2c1b0-b075-4d7b-be7c-54d26411cda3',
            legend: 'ch.swisstopo.geologie-geotope_kantone_stand',
          },
        ],
      },
    ],
  };

const group_09: LayerTreeNode =
  // Topic - Underground space
  {
    label: t('grp_15187_label'),
    children: [
      // Layer - Rock laboratories - WMS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_geologie_felslabore_label'),
        layer: 'ch.swisstopo.geologie-felslabore',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'f995a522-62cb-4316-a762-f6a319985ed7',
        legend: 'ch.swisstopo.geologie-felslabore',
      },
      // Layer - SP Deep Geol. Repositories - WMS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_bfe_sachplan_geologie_tiefenlager_label'),
        layer: 'ch.bfe.sachplan-geologie-tiefenlager',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '7162f14b-4c16-4ec3-8ac6-b158136e65c7',
        legend: 'ch.bfe.sachplan-geologie-tiefenlager',
      },
      {
        type: LayerType.tiles3d,
        assetId: 244982,
        label: t('lyr_road_tunnel_label'),
        layer: 'road_tunnel',
        pickable: true,
        opacityDisabled: true,
        geocatId: '752146b4-7fd4-4621-8cf8-fdb19f5335a5',
      },
      {
        type: LayerType.tiles3d,
        assetId: 244984,
        label: t('lyr_rail_tunnel_label'),
        layer: 'rail_tunnel',
        pickable: true,
        opacityDisabled: true,
        geocatId: '4897848c-3777-4636-9c7e-16ef91c723f6',
      },
      {
        type: LayerType.tiles3d,
        assetId: 244985,
        label: t('lyr_water_tunnel_label'),
        layer: 'water_tunnel',
        pickable: true,
        opacityDisabled: true,
        geocatId: '71ee97cb-91f8-427d-b217-f293a0a9760a',
      },
    ],
  };

const group_10: LayerTreeNode =
  // Topic - Background data
  {
    label: t('grp_1890_label'),
    children: [
      // Layer - Journey through time - Maps - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_zeitreihen_label'),
        layer: 'ch.swisstopo.zeitreihen',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '22287cd6-b75b-4caf-9413-aa3f196548b2',
        legend: 'ch.swisstopo.zeitreihen',
      },
      // Layer - CadastralWebMap - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_kantone_cadastralwebmap_farbe_label'),
        layer: 'ch.kantone.cadastralwebmap-farbe',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'cf93dfb6-ffff-43ce-bd9b-271baba2d217',
        legend: 'ch.kantone.cadastralwebmap-farbe',
      },
      // Layer - SWISSIMAGE Journey through time - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_swissimage_product_label'),
        layer: 'ch.swisstopo.swissimage-product',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: 'db5a52b4-0f5f-4998-a9a8-dd9539f93809',
        legend: 'ch.swisstopo.swissimage-product',
      },
      // Layer - swissALTI3D monodirectional hillshade - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t(
          'lyr_ch_swisstopo_swissalti3d_reliefschattierung_monodirektional_label',
        ),
        layer: 'ch.swisstopo.swissalti3d-reliefschattierung_monodirektional',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '376f86bd-c46c-4b89-8f36-717641706226',
        legend: 'ch.swisstopo.swissalti3d-reliefschattierung_monodirektional',
      },
      // Layer - swissALTI3D multidirectional hillshade - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_swissalti3d_reliefschattierung_label'),
        layer: 'ch.swisstopo.swissalti3d-reliefschattierung',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '1964cc81-5298-460f-9228-41120315bea8',
        legend: 'ch.swisstopo.swissalti3d-reliefschattierung',
      },
      // Layer - swissBATHY3D Hillshade - WMTS
      {
        type: LayerType.swisstopoWMTS,
        label: t('lyr_ch_swisstopo_swissbathy3d_reliefschattierung_label'),
        layer: 'ch.swisstopo.swissbathy3d-reliefschattierung',
        maximumLevel: 18,
        visible: false,
        displayed: false,
        opacity: 0.7,
        queryType: 'geoadmin',
        geocatId: '81949e93-f552-42b6-ab4b-5a2d529a7768',
        legend: 'ch.swisstopo.swissbathy3d-reliefschattierung',
      },
      {
        type: LayerType.tiles3d,
        url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swisstlm3d.3d/20201020/tileset.json',
        label: t('lyr_swiss_buildings_label'),
        layer: 'ch.swisstopo.swisstlm3d.3d',
        pickable: false,
        opacity: DEFAULT_LAYER_OPACITY,
        geocatId: '21c98c73-48da-408b-ab73-8f1ab9d5fbe4',
      },
    ],
  };

// Top-level Groups
const defaultLayerTree: LayerTreeNode[] = [
  group_01,
  group_02,
  group_03,
  group_04,
  group_05,
  group_06,
  group_07,
  group_08,
  group_09,
  group_10,
];

export const getDefaultLayerTree = (config: ClientConfig) =>
  filterLayer(defaultLayerTree, config.env);

const filterLayer = (layers: LayerTreeNode[], env: AppEnv): LayerTreeNode[] =>
  layers.reduce((acc, layer) => {
    const filteredLayer = { ...layer };
    if (layer.env !== undefined && !layer.env.includes(env)) {
      return acc;
    }
    if (layer.children !== undefined) {
      filteredLayer.children = filterLayer(layer.children, env);
    }
    acc.push(filteredLayer);
    return acc;
  }, [] as LayerTreeNode[]);

export const flattenLayers = (layers: LayerTreeNode[]): LayerTreeNode[] => {
  const flat: LayerTreeNode[] = [];
  for (const layer of layers) {
    if (layer.children) {
      flat.push(...flattenLayers(layer.children));
    } else {
      flat.push(layer);
    }
  }
  return flat;
};
