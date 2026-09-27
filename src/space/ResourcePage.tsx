import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSeekerResource, type SeekerResource } from '@/data/resources';
import { Spinner } from '@/ui/states';
import { ResourceView } from './ResourceView';

/** Your space → one resource (/space/resources/:id). */
export default function ResourcePage() {
  const { resourceId = '' } = useParams();
  const [resource, setResource] = useState<SeekerResource | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getSeekerResource(resourceId)
      .then((r) => active && setResource(r))
      .catch(() => active && setResource(null));
    return () => {
      active = false;
    };
  }, [resourceId]);

  return (
    <div className="flex flex-col gap-6">
      <Link to="/space/resources" className="text-sm text-muted hover:text-sage">
        ← Resources
      </Link>
      {resource === undefined ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-6 w-6" />
        </div>
      ) : resource === null ? (
        <p className="py-16 text-center text-sm text-muted">This resource isn’t available.</p>
      ) : (
        <ResourceView resource={resource} />
      )}
    </div>
  );
}
