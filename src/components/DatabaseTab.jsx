import { DataBasisEditor } from './DataBasisEditor.jsx';
import { ComponentEditor } from './ComponentEditor.jsx';
import { CatalogEditor } from './CatalogEditor.jsx';
import { LogicEditor } from './LogicEditor.jsx';
import { IntegrityPanel } from './IntegrityPanel.jsx';

/**
 * Database tab: the data integrity check, what the SOP data and the loading
 * patterns were checked against, then the editors for the SOP data itself.
 * Stateless — App owns the data.
 */
export const DatabaseTab = ({
    integrityIssues,
    dataBasis, dataBasisLabel, dataBasisCurrent, onRecordDataBasis,
    patternBasis, patternBasisLabel, patternBasisCurrent, onRecordPatternBasis,
    dbComponents, setDbComponents, dbCatalog, setDbCatalog,
    dbDiagrams, setDbDiagrams, dbBom, setDbBom, assignments
}) => (
    <div>
        <h2 className="text-xl font-bold mb-4">⚙️ Database</h2>
        <IntegrityPanel issues={integrityIssues} />
        <DataBasisEditor
            id="sop-data" title="📑 Data Basis (資料依據)" scope="Components、Catalog、示意圖與 BOM" example="SOP-000022 v9.0"
            dataBasis={dataBasis} dataBasisLabel={dataBasisLabel} isCurrent={dataBasisCurrent} onRecord={onRecordDataBasis}
        />
        <DataBasisEditor
            id="patterns" title="📑 Pattern Basis (滅菌 Pattern 依據)" scope="Autoclave 分頁的滅菌 Pattern" example="SOP-000077 v11.0"
            dataBasis={patternBasis} dataBasisLabel={patternBasisLabel} isCurrent={patternBasisCurrent} onRecord={onRecordPatternBasis}
        />
        <ComponentEditor dbComponents={dbComponents} setDbComponents={setDbComponents} dbBom={dbBom} />
        <CatalogEditor dbCatalog={dbCatalog} setDbCatalog={setDbCatalog} dbBom={dbBom} setDbBom={setDbBom} dbDiagrams={dbDiagrams} setDbDiagrams={setDbDiagrams} assignments={assignments} />
        <LogicEditor dbCatalog={dbCatalog} dbDiagrams={dbDiagrams} setDbDiagrams={setDbDiagrams} dbBom={dbBom} setDbBom={setDbBom} dbComponents={dbComponents} />
    </div>
);

export default DatabaseTab;
