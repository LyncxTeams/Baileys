/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class ObjectRepository {
    constructor(entities?: {});
    entityMap: Map<string, any>;
    findById(id: any): any;
    findAll(): any[];
    upsertById(id: any, entity: any): Map<string, any>;
    deleteById(id: any): boolean;
    count(): number;
    toJSON(): any[];
}
