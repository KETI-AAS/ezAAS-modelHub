import { getInstance } from "@/api";
import InstanceForm from "@/components/feature/instance/InstanceForm";

interface Props {
  params: {
    instanceSeq: string;
  };
}

export default async function Page({ params }: Props) {
  const { instanceSeq } = await params;
  const instance = await getInstance({
    instance_seq: instanceSeq,
  });

  return (
    <>
      {instance != null && <InstanceForm mode={"edit"} instance={instance} />}
    </>
  );
}
