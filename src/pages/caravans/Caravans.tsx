import { Outlet } from 'react-router-dom';

export default function Caravans() {
    return (
        <div className="container mx-auto py-6 animate-in fade-in duration-500">
            <Outlet />
        </div>
    );
}
