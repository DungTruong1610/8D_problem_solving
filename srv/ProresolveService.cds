using { cnma.proresolve as ns } from '../db/schema/schema';

@path: '/api/cnma/PRORESOLVE_SRV'
@(requires: 'authenticated-user')
service ProresolveService {
    entity SampleEntity as projection on ns.SampleEntity;
}
